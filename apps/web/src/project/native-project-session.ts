/**
 * A live native project: the typed write path between the editable document and
 * the SQLite working copy inside the Arq Worker.
 *
 * Three rules shape everything here, and each exists because breaking it loses
 * user work in a way nothing reports:
 *
 * 1. **In-memory canonical state advances only after the Worker confirms.** The
 *    obvious implementation applies the change locally and then persists it,
 *    which means a failed write leaves memory holding a state no file has - and
 *    the next save writes that phantom state as though it were committed.
 * 2. **A failed write must not poison the queue.** Saves are serialized through
 *    one promise chain. Chaining the next save onto a rejected tail cancels
 *    every later save silently: the first failure would be the last save the
 *    project ever attempted.
 * 3. **Close always attempts Worker shutdown.** Returning early on a failed
 *    final save leaks the Worker, and with it the OPFS write lock on the working
 *    copy - so the project cannot be reopened in the same session.
 */
import { exportArchive, type ArqManifest } from '@arq/project-format';
import type { ArqfsWorkerClient } from '@arq/arqfs';
import type {
  ArqfsPublicationReceipt,
  ArqfsPublicationRefusal,
} from '@arq/arqfs/src/arqfs-publication';
import type { NativeProjectModel as NativeProjectDocument } from '@arq/project-loading';
import type { DrawnWall, WorkspaceOperation } from '../canvas/plan-document';
import { encodeNativeProjectModel } from './native-project-model';

/** Everything the workspace needs to render and describe the open project. */
export interface NativeProjectSnapshot {
  /** Identifies the OPFS working copy, not the project - two different things that must be checked against each other on resume. */
  readonly workingCopyId: string;
  /** The project's own identity, as recorded in its manifest. */
  readonly projectId: string;
  readonly displayName: string;
  readonly walls: readonly DrawnWall[];
  /**
   * The reference-format model when the file carried one, so a surface can show
   * levels, wall types and rooms rather than only the walls the plan canvas
   * edits. Null for a project written by this build, which has none of that to
   * show - the absence is the honest answer, not a missing feature.
   */
  readonly document: NativeProjectDocument | null;
  readonly journalSequence: number;
  /**
   * The project's semantic hash as opened, over every archive entry.
   *
   * Carried on the snapshot because `@arq/derived-cache` decides whether cached
   * geometry still describes this project by comparing the hash it stored
   * against the project's current one, and nothing produced a current one for an
   * opened project. Not a verification of the file: no manifest or schema
   * records an expected value to check this against.
   */
  readonly semanticHash: string;
  readonly readOnly: boolean;
  /** Which VFS actually backs the working copy - reported honestly, never assumed to be persistent. */
  readonly usedVfs: string;
  readonly warnings: readonly string[];
}

export interface NativeProjectChange {
  readonly displayName?: string;
  readonly walls?: readonly DrawnWall[];
  readonly operation?: WorkspaceOperation;
  readonly journalSequence?: number;
}

/** The Worker surface a session needs. Narrowed to what is used, so tests do not have to fake a whole client. */
export interface NativeProjectWorkerHandle {
  readonly client: Pick<ArqfsWorkerClient, 'request' | 'dispose'>;
  readonly terminate: () => void;
}

/**
 * What a caller gets back from `publish`. Deliberately not the raw
 * `ArqfsPublicationResult`: a refusal that left bytes in the Worker's VFS is
 * the Worker's problem to clean up and has already been dealt with by the time
 * this returns, so `targetWritten` would describe a state the caller cannot
 * observe and must not act on.
 */
export type NativePublishResult =
  | {
      readonly status: 'published';
      readonly receipt: ArqfsPublicationReceipt;
      /** The verified bytes, for the caller to hand to the user. */
      readonly bytes: Uint8Array;
    }
  | {
      readonly status: 'refused';
      readonly reason: ArqfsPublicationRefusal;
      readonly detail: string;
    };

export class NativeProjectReadOnlyError extends Error {
  constructor() {
    super('This project is open for reading only, so it was not changed.');
    this.name = 'NativeProjectReadOnlyError';
  }
}

/**
 * The flat wall encoder cannot preserve a reference-format project's levels,
 * wall types, rooms, openings, hosted elements or views.
 */
export class NativeProjectUnsupportedEditError extends Error {
  constructor() {
    super(
      'This reference-format project cannot persist wall edits until ARQ can preserve its full semantic model.',
    );
    this.name = 'NativeProjectUnsupportedEditError';
  }
}

/**
 * What `prepareForPublication` hands to `publishNativeProject` once the working
 * copy is genuinely ready to be exported: everything drained, checkpointed and
 * read back, with nothing left for the caller to coordinate against this
 * session's private state.
 */
export type NativeProjectPublicationPreparation =
  | {
      readonly status: 'ready';
      readonly projectId: string;
      readonly displayName: string;
      /** The number of operations this working copy has actually committed - not a caller-suppliable counter, so it cannot drift from what was really applied. */
      readonly revision: number;
      readonly sourceSemanticHash: string;
      readonly bytes: Uint8Array;
    }
  | { readonly status: 'rejected'; readonly code: string; readonly reason: string };

export class NativeProjectSession {
  /**
   * The committed state: what the working copy is known to contain. Replaced
   * only by a write the Worker acknowledged.
   */
  #snapshot: NativeProjectSnapshot;
  #operations: readonly unknown[];
  readonly #manifest: ArqManifest;
  readonly #handle: NativeProjectWorkerHandle;

  /**
   * Settles rather than rejects, always. The promise a caller gets back from
   * `save` carries the failure; this tail only orders the next write.
   */
  #queue: Promise<void> = Promise.resolve();
  /** Changes that became visible in the editor but whose Worker write failed. */
  #pendingChanges: readonly NativeProjectChange[] = [];
  #lastWriteError: unknown = null;
  #closed = false;

  /**
   * Released when this session closes.
   *
   * Held by the session rather than by the open pipeline because the lease has
   * to outlive the open and end with the project: a lock released as soon as the
   * project finished opening would guarantee nothing, and one never released
   * would keep every other tab read-only until this one is closed.
   */
  readonly #releaseWriterLease: () => void;

  constructor(
    handle: NativeProjectWorkerHandle,
    snapshot: NativeProjectSnapshot,
    manifest: ArqManifest,
    operations: readonly unknown[] = [],
    releaseWriterLease: () => void = () => {},
  ) {
    this.#handle = handle;
    this.#snapshot = snapshot;
    this.#manifest = manifest;
    this.#operations = operations;
    this.#releaseWriterLease = releaseWriterLease;
  }

  snapshot(): NativeProjectSnapshot {
    return this.#snapshot;
  }

  /** Whether the last acknowledged write failed. The interface must not describe a project as saved while this is true. */
  get hasUnsavedFailure(): boolean {
    return this.#lastWriteError !== null;
  }

  save(change: NativeProjectChange): Promise<void> {
    if (this.#closed) {
      return Promise.reject(new Error('This project has been closed.'));
    }
    if (this.#snapshot.readOnly) {
      // Refused here as well as in the Worker. The Worker gate is the one that
      // cannot be bypassed; this one keeps a read-only project from queueing
      // work that was never going to land.
      return Promise.reject(new NativeProjectReadOnlyError());
    }

    if (this.#snapshot.document !== null) {
      // The current wall operation carries centreline geometry only. Passing a
      // reference project through the flat encoder would silently discard its
      // richer canonical model, so this is a hard session-level boundary.
      return Promise.reject(new NativeProjectUnsupportedEditError());
    }

    const run = (): Promise<void> => this.#commit(change);
    // `then(run, run)` on both settlements is the whole of rule 2: the next save
    // runs whether or not the previous one rejected.
    const result = this.#queue.then(run, run);
    this.#queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /**
   * Publishes the working project to a verified portable file.
   *
   * Queued behind in-flight writes, not run beside them. A publication is a
   * claim about a committed revision, and `publishProjectFile` refuses outright
   * if the working copy has an unsettled write - so racing a save would turn an
   * ordinary "wait your turn" into a refusal the user has to understand and
   * retry.
   *
   * Refused for a read-only project here as well as in the Worker, matching
   * `save`: publication issues a WAL checkpoint and records its outcome, and a
   * project this build must not write should not queue work that was never
   * going to land.
   */
  publish(options: { readonly expectedRevision?: number } = {}): Promise<NativePublishResult> {
    if (this.#closed) {
      return Promise.reject(new Error('This project has been closed.'));
    }
    if (this.#snapshot.readOnly) {
      return Promise.reject(new NativeProjectReadOnlyError());
    }

    const run = (): Promise<NativePublishResult> => this.#publish(options);
    const result = this.#queue.then(run, run);
    this.#queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async #publish(options: { readonly expectedRevision?: number }): Promise<NativePublishResult> {
    const payload = await this.#handle.client.request({
      type: 'publish',
      // Named from the working copy rather than the display name: the display
      // name is the user's and can contain anything, while this is a key inside
      // the Worker's own VFS. What the user sees is decided when the bytes are
      // saved, which is not this layer's business.
      targetName: `${this.#snapshot.workingCopyId}-published`,
      ...(options.expectedRevision === undefined
        ? {}
        : { expectedRevision: options.expectedRevision }),
    });
    if (payload.kind !== 'publish') {
      throw new Error('The project did not report a publication result.');
    }
    if (payload.result.status !== 'published') {
      return { status: 'refused', reason: payload.result.reason, detail: payload.result.detail };
    }
    if (payload.bytes === null) {
      // The verdict said published and no bytes came back. Reported as a
      // refusal rather than resolved: there is nothing to hand the user, and a
      // success with no file is the one outcome that must not be described as
      // success.
      return {
        status: 'refused',
        reason: 'export-failed',
        detail: 'The publication was verified but its bytes were not returned.',
      };
    }
    return { status: 'published', receipt: payload.result.receipt, bytes: payload.bytes };
  }

  async #commit(change: NativeProjectChange): Promise<void> {
    // Reapply failed changes in order, then the newest state. A later full wall
    // state therefore remains authoritative (including undo), while operation
    // history from a transient failure is not silently dropped.
    const pending = [...this.#pendingChanges, change];
    let next = this.#snapshot;
    let nextOperations = this.#operations;

    for (const candidate of pending) {
      next = {
        ...next,
        displayName: candidate.displayName ?? next.displayName,
        walls: candidate.walls ?? next.walls,
        journalSequence:
          candidate.journalSequence ??
          (candidate.operation === undefined ? next.journalSequence : next.journalSequence + 1),
      };
      if (candidate.operation !== undefined) {
        nextOperations = [...nextOperations, candidate.operation];
      }
    }

    const entries = await exportArchive({
      manifest: this.#manifest,
      model: encodeNativeProjectModel({ projectName: next.displayName, walls: next.walls }),
      operations: nextOperations,
    });

    try {
      await this.#handle.client.request({
        type: 'putArchiveEntries',
        entries: [...entries],
      });
    } catch (error) {
      // Canonical state remains the last Worker-acknowledged snapshot. Keep the
      // intended changes only for the next save attempt.
      this.#pendingChanges = pending;
      this.#lastWriteError = error;
      throw error;
    }

    this.#snapshot = next;
    this.#operations = nextOperations;
    this.#pendingChanges = [];
    this.#lastWriteError = null;
  }

  /**
   * The canonical semantic hash of this project's current committed content. A
   * plain passthrough - used by `publishNativeProject` on both the source
   * session and a freshly reopened verification session, since proving the two
   * mean the same thing takes a comparison neither connection can make alone.
   *
   * Not gated on `readOnly`: hashing is a read, and a read-only project's
   * content is exactly as hashable as a writable one's.
   */
  async computeSemanticHash(): Promise<string> {
    if (this.#closed) {
      throw new Error('This project has been closed.');
    }
    const payload = await this.#handle.client.request({ type: 'computeSemanticHash' });
    if (payload.kind !== 'computeSemanticHash') {
      throw new Error(`unexpected computeSemanticHash response: ${payload.kind}`);
    }
    return payload.hash;
  }

  /**
   * Drains every in-flight write, then checkpoints and exports the working
   * copy - the state a publication has to be built from, and the only moment
   * "exact working revision" (ARQ's own phrase for this) is actually true: not
   * before the queue is empty, and not after some later write has landed.
   *
   * Queued through the same `#queue` chain `save` uses, for the same reason
   * `save` serializes through it: a publish that merely awaited a snapshot of
   * `#queue` could still race a `save` called moments later, exporting bytes
   * that were correct when the export request was issued and stale by the time
   * it actually ran. Becoming a step in the queue instead of a spectator of it
   * closes that window structurally.
   */
  prepareForPublication(): Promise<NativeProjectPublicationPreparation> {
    if (this.#closed) {
      return Promise.resolve({
        status: 'rejected',
        code: 'ARQ_PUBLISH_CLOSED',
        reason: 'This project has been closed, so it cannot be published.',
      });
    }
    if (this.#snapshot.readOnly) {
      return Promise.resolve({
        status: 'rejected',
        code: 'ARQ_PUBLISH_READ_ONLY',
        reason: 'This project is open for reading only, so it cannot be published.',
      });
    }

    const run = (): Promise<NativeProjectPublicationPreparation> => this.#prepare();
    const result = this.#queue.then(run, run);
    this.#queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async #prepare(): Promise<NativeProjectPublicationPreparation> {
    // Read after draining, not before: this is the queue's own last write
    // outcome, not whatever it was when `prepareForPublication` was called.
    if (this.#lastWriteError !== null) {
      return {
        status: 'rejected',
        code: 'ARQ_PUBLISH_UNSAVED_FAILURE',
        reason:
          'The last change to this project failed to reach the working copy, so it was not published.',
      };
    }
    try {
      const hashPayload = await this.#handle.client.request({ type: 'computeSemanticHash' });
      if (hashPayload.kind !== 'computeSemanticHash') {
        throw new Error(`unexpected computeSemanticHash response: ${hashPayload.kind}`);
      }
      const exportPayload = await this.#handle.client.request({ type: 'exportDatabase' });
      if (exportPayload.kind !== 'exportDatabase') {
        throw new Error(`unexpected exportDatabase response: ${exportPayload.kind}`);
      }
      return {
        status: 'ready',
        projectId: this.#snapshot.projectId,
        displayName: this.#snapshot.displayName,
        revision: this.#operations.length,
        sourceSemanticHash: hashPayload.hash,
        bytes: exportPayload.bytes,
      };
    } catch (error) {
      return {
        status: 'rejected',
        code: 'ARQ_PUBLISH_EXPORT_FAILED',
        reason: error instanceof Error ? error.message : 'The working copy could not be exported.',
      };
    }
  }

  /**
   * Shuts the project down and reports whether its work is actually safe.
   *
   * Rejects when the last write failed, *after* completing shutdown - closing
   * cleanly would tell the user their project was put away safely when its most
   * recent change never reached the file.
   */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;

    // The tail never rejects, so this waits for in-flight writes without
    // needing to catch - and without skipping shutdown if one failed.
    await this.#queue;

    try {
      await this.#handle.client.request({ type: 'close' });
    } catch (error) {
      if (this.#lastWriteError === null) this.#lastWriteError = error;
    } finally {
      // Rule 3. All three run even if `close` threw, because the Worker holds the
      // OPFS write lock on this project's working copy and a leaked lock makes
      // the project unopenable for the rest of the session. The writer lease is
      // released for the same reason at origin scope: a lease this tab never
      // gives back leaves every other tab read-only on this project until the
      // tab is closed, which looks exactly like the lock being broken.
      this.#handle.client.dispose();
      this.#handle.terminate();
      this.#releaseWriterLease();
    }

    if (this.#lastWriteError !== null) throw this.#lastWriteError;
  }
}

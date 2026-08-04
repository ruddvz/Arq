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
  readonly journalSequence: number;
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

export class NativeProjectReadOnlyError extends Error {
  constructor() {
    super('This project is open for reading only, so it was not changed.');
    this.name = 'NativeProjectReadOnlyError';
  }
}

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
  #lastWriteError: unknown = null;
  #closed = false;

  constructor(
    handle: NativeProjectWorkerHandle,
    snapshot: NativeProjectSnapshot,
    manifest: ArqManifest,
    operations: readonly unknown[] = [],
  ) {
    this.#handle = handle;
    this.#snapshot = snapshot;
    this.#manifest = manifest;
    this.#operations = operations;
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

  async #commit(change: NativeProjectChange): Promise<void> {
    // Built from the *committed* snapshot, read now rather than when `save` was
    // called, so a queued write always extends what actually landed.
    const committed = this.#snapshot;
    const next: NativeProjectSnapshot = {
      ...committed,
      displayName: change.displayName ?? committed.displayName,
      walls: change.walls ?? committed.walls,
      journalSequence: change.journalSequence ?? committed.journalSequence,
    };
    const nextOperations =
      change.operation === undefined ? this.#operations : [...this.#operations, change.operation];

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
      // Rule 1: nothing above this line has touched #snapshot, and nothing
      // below it runs. The project in memory is still exactly what the working
      // copy holds.
      this.#lastWriteError = error;
      throw error;
    }

    this.#snapshot = next;
    this.#operations = nextOperations;
    this.#lastWriteError = null;
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
      // Rule 3. Both run even if `close` threw, because the Worker holds the
      // OPFS write lock on this project's working copy and a leaked lock makes
      // the project unopenable for the rest of the session.
      this.#handle.client.dispose();
      this.#handle.terminate();
    }

    if (this.#lastWriteError !== null) throw this.#lastWriteError;
  }
}

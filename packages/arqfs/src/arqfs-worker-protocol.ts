/**
 * The request/response message shapes between a main-thread caller and the
 * Arq-owned dedicated Worker that actually runs SQLite (ADR-0024) - shared here so a
 * future main-thread client and workers/arqfs-worker's implementation stay in sync
 * without either importing the other's runtime code. postMessage RPC is
 * request/response with an `id` for correlation, not a raw exec/query passthrough -
 * batches whole operations across the JS/WASM Worker boundary rather than one
 * message per SQL statement (docs/architecture/SHARED-RUST-CORE.md's WASM guidance:
 * "avoid frequent small calls across the JS and WASM boundary; batch queries and
 * operations").
 */
import type { ArqfsOpenResult } from './arqfs-open';
import type { ArqfsIntegrityReport } from './arqfs-integrity';
import type { ArqfsPublicationResult } from './arqfs-publication';

export type ArqfsWorkerRequest =
  /**
   * Seeds this Worker's project-scoped working copy from the bytes a user
   * selected, before any open.
   *
   * This exists because there is no other way in. `opfs-sahpool` does not store
   * databases as plain OPFS files under the name it was given - it keeps them
   * inside a pool of opaque files it manages itself - so the main thread cannot
   * write a selected `.arq` to a path and have SQLite find it. Only the pool
   * utility, which lives in the Worker, can import bytes into that pool. Without
   * this command the Worker can only ever create an empty database, which is why
   * native project opening was not reachable at all.
   *
   * Deliberately a separate command rather than an argument to `open`: importing
   * replaces the working copy's entire contents, which is not something an open
   * should do implicitly.
   */
  | { readonly id: number; readonly type: 'importDatabase'; readonly bytes: Uint8Array }
  | { readonly id: number; readonly type: 'open' }
  | {
      readonly id: number;
      readonly type: 'putArchiveEntries';
      readonly entries: ReadonlyArray<readonly [string, Uint8Array]>;
    }
  /**
   * The other direction of `importDatabase`: switches the working copy out of
   * WAL mode and returns its bytes as a clean, standalone file - no `-wal` or
   * `-shm` dependency, because journal_mode=DELETE both merges anything pending
   * back into the main file and rewrites the header bytes that declare which
   * mode the file is in, before the bytes are read.
   *
   * Gated on the same write capability as `putArchiveEntries`, not merely on an
   * accepted open: switching journal mode physically rewrites the file's pages
   * and its header, and a file this build must not write must not have its
   * bytes touched at all, even in the direction of tidying them up.
   */
  | { readonly id: number; readonly type: 'exportDatabase' }
  /**
   * ARQ-200/222's canonical semantic hash over the working copy, computed on
   * request rather than folded into another response so it can be asked for
   * independently - a fresh-reader reopen needs to compute the same thing over
   * a different connection to compare against it.
   */
  | { readonly id: number; readonly type: 'computeSemanticHash' }
  /**
   * SQLite's own health check over the working copy.
   *
   * `checkArqfsIntegrity`'s documented purpose is "before trusting an
   * imported/copied file", and nothing outside the Worker could ask for it - so
   * a working copy seeded by `importDatabase` was opened and decoded with
   * nothing having established that the copy is sound. `open` does not cover
   * this: it reads the header and the metadata table, which a database with
   * damaged pages elsewhere answers perfectly well.
   */
  | { readonly id: number; readonly type: 'checkIntegrity' }
  | { readonly id: number; readonly type: 'getArchiveEntry'; readonly path: string }
  | { readonly id: number; readonly type: 'listArchiveEntryPaths' }
  /**
   * Every logical entry in one round trip. A native open needs the manifest and the
   * model together before it may adopt anything, and asking for them one path at a
   * time would cross the Worker boundary once per entry for a decision that is only
   * ever made on the whole set - exactly the "frequent small calls" this protocol's
   * batching rule exists to avoid.
   */
  | { readonly id: number; readonly type: 'readAllArchiveEntries' }
  /**
   * Publishes the working project to a portable file and verifies it with a
   * fresh reader (`publishProjectFile`).
   *
   * It has to run here, and not on the main thread, for the same reason
   * `importDatabase` does: `VACUUM INTO` writes through the VFS, and only this
   * Worker has the `opfs-sahpool` pool utility that can then open the result as
   * an independent connection. A main thread that asked for the bytes and
   * verified them itself would be verifying a copy of a copy - which is exactly
   * the reader-shares-nothing-with-the-writer property publication depends on,
   * broken.
   */
  | {
      readonly id: number;
      readonly type: 'publish';
      /** Name for the published file inside this Worker's VFS, not a user-facing path. */
      readonly targetName: string;
      /** Publish only if the working project is on this revision. */
      readonly expectedRevision?: number;
    }
  | { readonly id: number; readonly type: 'close' };

export type ArqfsWorkerResponsePayload =
  | { readonly kind: 'importDatabase'; readonly byteLength: number }
  | { readonly kind: 'open'; readonly result: ArqfsOpenResult; readonly usedVfs: string }
  | { readonly kind: 'checkIntegrity'; readonly report: ArqfsIntegrityReport }
  | { readonly kind: 'exportDatabase'; readonly bytes: Uint8Array }
  | { readonly kind: 'computeSemanticHash'; readonly hash: string }
  | { readonly kind: 'putArchiveEntries' }
  | { readonly kind: 'getArchiveEntry'; readonly content: Uint8Array | null }
  | { readonly kind: 'listArchiveEntryPaths'; readonly paths: readonly string[] }
  | {
      readonly kind: 'readAllArchiveEntries';
      readonly entries: ReadonlyArray<readonly [string, Uint8Array]>;
    }
  | {
      readonly kind: 'publish';
      readonly result: ArqfsPublicationResult;
      /**
       * The verified bytes, present only when `result.status` is `published`.
       *
       * Carried on the same response as the verdict so a caller cannot hand a
       * file to a user without the receipt that says it was checked - the two
       * would otherwise be separate round trips, and the file would be
       * available first.
       */
      readonly bytes: Uint8Array | null;
    }
  | { readonly kind: 'close' };

/**
 * Stable refusal codes.
 *
 * A caller has to be able to tell "this file is not writable by this build" from
 * "something went wrong", and a message string is not a contract: it is prose that
 * changes when someone improves the wording. These are the contract.
 */
export const ARQFS_WORKER_ERROR_CODES = {
  /** A write arrived before any successful open. */
  notOpened: 'ARQFS_WORKER_NOT_OPENED',
  /** The open succeeded for reading, and this build must not write this file. */
  notWritable: 'ARQFS_WORKER_FILE_NOT_WRITABLE',
  /** The open itself was rejected, or it succeeded only in a form this build must not read from; nothing may be handed back from this file. */
  openRejected: 'ARQFS_WORKER_OPEN_REJECTED',
  /** This context has no way to hand back the working copy's raw bytes (e.g. the in-memory fallback used when OPFS is unavailable). */
  exportUnsupported: 'ARQFS_WORKER_EXPORT_UNSUPPORTED',
  /** The request was not a shape this protocol defines, so nothing was attempted. */
  malformedRequest: 'ARQFS_WORKER_MALFORMED_REQUEST',
  /** This Worker has no way to publish - it is not backed by a VFS that can export and reopen a file. */
  publishUnavailable: 'ARQFS_WORKER_PUBLISH_UNAVAILABLE',
  /** Anything unexpected. Deliberately last: a specific code is always preferred. */
  unexpected: 'ARQFS_WORKER_UNEXPECTED_ERROR',
} as const;

export type ArqfsWorkerErrorCode =
  (typeof ARQFS_WORKER_ERROR_CODES)[keyof typeof ARQFS_WORKER_ERROR_CODES];

/**
 * Every response names the project it came from, not only the request it
 * answers. A request id is unique inside one client, so id correlation alone
 * cannot tell a client that the message it just received came from a Worker
 * opened for a different project - and OPFS is shared at the origin, so "a
 * different project" means "different bytes at the same storage." Two
 * Workers alive at once during a project switch is the ordinary case, not an
 * exotic one, which is why the answer carries its own identity rather than
 * relying on the caller having wired the transport correctly.
 */
export type ArqfsWorkerResponse =
  | {
      readonly id: number;
      readonly projectId: string;
      readonly ok: true;
      readonly payload: ArqfsWorkerResponsePayload;
    }
  | {
      readonly id: number;
      readonly projectId: string;
      readonly ok: false;
      readonly code: ArqfsWorkerErrorCode;
      readonly error: string;
    };

/**
 * V3-021: the request boundary, checked at runtime rather than asserted.
 *
 * `ArqfsWorkerRequest` describes what a caller is supposed to send. Until this
 * function existed, nothing checked that they had: the Worker entry typed
 * `event.data` as `ArqfsWorkerRequest` and handed it straight to the handler.
 * A type annotation on a postMessage payload is a note about intent, not a
 * guarantee - the value arrives from another execution context and is whatever
 * that context posted.
 *
 * The asymmetry is the tell. `ArqfsWorkerClient.onMessage` already validates
 * responses before trusting `response.id`, because a malformed response was
 * understood to be possible. Requests cross the same kind of boundary in the
 * other direction and were taken on faith.
 *
 * What that cost concretely: `handleArqfsWorkerRequest`'s `switch` covers every
 * member of the union, so TypeScript reads it as exhaustive and allows the
 * implicit fall-through. At runtime an unrecognised `type` fell out of the
 * switch, the function returned `undefined`, and the Worker posted that -
 * so the client's correlation map never matched, and the caller waited out its
 * full timeout for a request that was rejected the moment it arrived. The
 * handler's own doc comment promised "every branch is caught and reported as an
 * `ok: false` response"; for an unrecognised type that was not true.
 *
 * Structural checks only - the fields each variant needs, at the types the
 * handler will use them at. This is not schema validation and does not try to
 * be: `path` being a string is checkable here, `path` naming a real entry is
 * the store's business.
 */
export function parseArqfsWorkerRequest(value: unknown): ArqfsWorkerRequest | null {
  if (value === null || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  // `id` correlates the response. A request without a usable one cannot be
  // answered at all, so it is rejected before its type is even considered.
  if (typeof candidate['id'] !== 'number' || !Number.isFinite(candidate['id'])) return null;
  const id = candidate['id'];

  switch (candidate['type']) {
    case 'importDatabase':
      return candidate['bytes'] instanceof Uint8Array
        ? { id, type: 'importDatabase', bytes: candidate['bytes'] }
        : null;
    case 'open':
      return { id, type: 'open' };
    case 'exportDatabase':
      return { id, type: 'exportDatabase' };
    case 'computeSemanticHash':
      return { id, type: 'computeSemanticHash' };
    case 'checkIntegrity':
      return { id, type: 'checkIntegrity' };
    case 'putArchiveEntries': {
      const entries = candidate['entries'];
      if (!Array.isArray(entries)) return null;
      const checked: (readonly [string, Uint8Array])[] = [];
      for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length !== 2) return null;
        const [path, content] = entry as [unknown, unknown];
        if (typeof path !== 'string' || !(content instanceof Uint8Array)) return null;
        checked.push([path, content]);
      }
      return { id, type: 'putArchiveEntries', entries: checked };
    }
    case 'getArchiveEntry':
      return typeof candidate['path'] === 'string'
        ? { id, type: 'getArchiveEntry', path: candidate['path'] }
        : null;
    case 'listArchiveEntryPaths':
      return { id, type: 'listArchiveEntryPaths' };
    case 'readAllArchiveEntries':
      return { id, type: 'readAllArchiveEntries' };
    case 'publish': {
      if (typeof candidate['targetName'] !== 'string' || candidate['targetName'] === '') {
        return null;
      }
      const expected = candidate['expectedRevision'];
      if (expected !== undefined && (typeof expected !== 'number' || !Number.isInteger(expected))) {
        return null;
      }
      return {
        id,
        type: 'publish',
        targetName: candidate['targetName'],
        ...(expected === undefined ? {} : { expectedRevision: expected }),
      };
    }
    case 'close':
      return { id, type: 'close' };
    default:
      return null;
  }
}

/**
 * The `id` to answer a request under when the request itself did not parse.
 *
 * A malformed request usually still carries a usable correlation id - the
 * common case is a caller on a newer protocol version sending a `type` this
 * build does not know, not a caller sending garbage. Answering under that id
 * turns a timeout into an immediate, specific refusal. When there is no usable
 * id there is nothing to correlate against and the caller can only time out;
 * `null` says so rather than inventing one.
 */
export function correlationIdOf(value: unknown): number | null {
  if (value === null || typeof value !== 'object') return null;
  const id = (value as Record<string, unknown>)['id'];
  return typeof id === 'number' && Number.isFinite(id) ? id : null;
}

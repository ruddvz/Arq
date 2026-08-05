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
  /** Anything unexpected. Deliberately last: a specific code is always preferred. */
  unexpected: 'ARQFS_WORKER_UNEXPECTED_ERROR',
} as const;

export type ArqfsWorkerErrorCode =
  (typeof ARQFS_WORKER_ERROR_CODES)[keyof typeof ARQFS_WORKER_ERROR_CODES];

export type ArqfsWorkerResponse =
  | { readonly id: number; readonly ok: true; readonly payload: ArqfsWorkerResponsePayload }
  | {
      readonly id: number;
      readonly ok: false;
      readonly code: ArqfsWorkerErrorCode;
      readonly error: string;
    };

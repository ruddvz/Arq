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
import type { ArqfsSidecarDependency } from './arqfs-preflight';

export type ArqfsWorkerRequest =
  | { readonly id: number; readonly type: 'open' }
  | {
      /**
       * Replace this Worker's working database with the selected source bytes.
       *
       * This is the request that makes an ARQ-owned OPFS working project
       * reachable at all: a file picker hands the main thread bytes, and until
       * they are inside the Worker's own OPFS file there is nothing for `open`
       * to open but an empty database this build just created. Without it the
       * only openable project was one this build had authored itself.
       *
       * Deliberately separate from `open`, and only legal before it: `open`
       * decides what this build may do with this file, and swapping the file
       * out from under that decision would leave every later write measured
       * against a database that is no longer there.
       */
      readonly id: number;
      readonly type: 'importDatabase';
      readonly bytes: Uint8Array;
    }
  | {
      readonly id: number;
      readonly type: 'putArchiveEntries';
      readonly entries: ReadonlyArray<readonly [string, Uint8Array]>;
    }
  | { readonly id: number; readonly type: 'getArchiveEntry'; readonly path: string }
  | { readonly id: number; readonly type: 'listArchiveEntryPaths' }
  | { readonly id: number; readonly type: 'close' };

export type ArqfsWorkerResponsePayload =
  | { readonly kind: 'open'; readonly result: ArqfsOpenResult; readonly usedVfs: string }
  | {
      readonly kind: 'importDatabase';
      /** What byte preflight found in the imported source, so the caller need not re-read it. */
      readonly sidecarDependency: ArqfsSidecarDependency;
      readonly byteLength: number;
    }
  | { readonly kind: 'putArchiveEntries' }
  | { readonly kind: 'getArchiveEntry'; readonly content: Uint8Array | null }
  | { readonly kind: 'listArchiveEntryPaths'; readonly paths: readonly string[] }
  | { readonly kind: 'close' };

/**
 * Stable refusal codes.
 *
 * A caller has to be able to tell "this file is not writable by this build" from
 * "something went wrong", and a message string is not a contract: it is prose that
 * changes when someone improves the wording. These are the contract.
 */
export const ARQFS_WORKER_ERROR_CODES = {
  /** A read or write arrived before any successful open. */
  notOpened: 'ARQFS_WORKER_NOT_OPENED',
  /** The open succeeded for reading, and this build must not write this file. */
  notWritable: 'ARQFS_WORKER_FILE_NOT_WRITABLE',
  /**
   * The open produced a result this build must not read from: a safe-mode open,
   * where the file could not be fully understood. Distinct from `openRejected`,
   * which is a file that was never opened at all.
   */
  notReadable: 'ARQFS_WORKER_FILE_NOT_READABLE',
  /** The open itself was rejected; nothing may be done with this file. */
  openRejected: 'ARQFS_WORKER_OPEN_REJECTED',
  /** An import arrived after this session had already opened or closed its database. */
  importNotAllowed: 'ARQFS_WORKER_IMPORT_NOT_ALLOWED',
  /** This Worker's storage backend cannot import a database (no OPFS in this context). */
  importUnsupported: 'ARQFS_WORKER_IMPORT_UNSUPPORTED',
  /** The bytes offered for import failed byte preflight; nothing was imported. */
  sourceRejected: 'ARQFS_WORKER_SOURCE_REJECTED',
  /** Anything unexpected. Deliberately last: a specific code is always preferred. */
  unexpected: 'ARQFS_WORKER_UNEXPECTED_ERROR',
} as const;

export type ArqfsWorkerErrorCode =
  (typeof ARQFS_WORKER_ERROR_CODES)[keyof typeof ARQFS_WORKER_ERROR_CODES];

/**
 * Every response names the project it came from, not only the request it answers.
 *
 * A request id is unique inside one client, so id correlation alone cannot tell a
 * client that the message it just received came from a Worker opened for a
 * different project - and OPFS is shared at the origin, so "a different project"
 * means "different bytes at the same storage". Two Workers alive at once during a
 * project switch is the ordinary case, not an exotic one, which is why the answer
 * carries its own identity rather than relying on the caller having wired the
 * transport correctly.
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

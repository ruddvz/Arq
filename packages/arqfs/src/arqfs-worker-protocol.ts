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

export type ArqfsWorkerRequest =
  | { readonly id: number; readonly type: 'open' }
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
  /** A write arrived before any successful open. */
  notOpened: 'ARQFS_WORKER_NOT_OPENED',
  /** The open succeeded for reading, and this build must not write this file. */
  notWritable: 'ARQFS_WORKER_FILE_NOT_WRITABLE',
  /** The open itself was rejected; nothing may be done with this file. */
  openRejected: 'ARQFS_WORKER_OPEN_REJECTED',
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

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
import type { ArqfsRecoveryReport } from './arqfs-recovery-report';
import type { ArqfsWorkingCopyState } from './arqfs-working-copy';

export type ArqfsWorkerRequest =
  | { readonly id: number; readonly type: 'open' }
  /**
   * Open bytes the user selected, rather than this Worker's own project file.
   *
   * A separate request type rather than an argument to `open` because the two
   * have opposite defaults: `open` may initialise a schema on a database this
   * build owns, and this must never do so on a file it was handed. The Worker
   * entry, not the shared handler, turns the bytes into a connection; the
   * handler decides what may be done with it (see `ArqfsWorkerContext.source`).
   */
  | { readonly id: number; readonly type: 'openSelectedBytes'; readonly bytes: Uint8Array }
  | {
      readonly id: number;
      readonly type: 'putArchiveEntries';
      readonly entries: ReadonlyArray<readonly [string, Uint8Array]>;
    }
  | { readonly id: number; readonly type: 'getArchiveEntry'; readonly path: string }
  | { readonly id: number; readonly type: 'listArchiveEntryPaths' }
  /** The facts arqfs-recovery-report.ts computes: open result, required entries, SQLite health, interrupted write. */
  | { readonly id: number; readonly type: 'recoveryReport' }
  /** Project identity and revision as the file itself records them. */
  | { readonly id: number; readonly type: 'readWorkingCopyState' }
  | { readonly id: number; readonly type: 'close' };

export type ArqfsWorkerResponsePayload =
  | { readonly kind: 'open'; readonly result: ArqfsOpenResult; readonly usedVfs: string }
  | { readonly kind: 'putArchiveEntries' }
  | { readonly kind: 'getArchiveEntry'; readonly content: Uint8Array | null }
  | { readonly kind: 'listArchiveEntryPaths'; readonly paths: readonly string[] }
  | { readonly kind: 'recoveryReport'; readonly report: ArqfsRecoveryReport }
  | { readonly kind: 'readWorkingCopyState'; readonly state: ArqfsWorkingCopyState | null }
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
  /**
   * The connection holds bytes the user selected. Those bytes are an immutable
   * copy of a file this build does not own, so no write is permitted regardless
   * of what the file's own version floors would otherwise allow.
   */
  selectedSourceReadOnly: 'ARQFS_WORKER_SELECTED_SOURCE_READ_ONLY',
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

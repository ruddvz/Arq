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
  /** The request was not a shape this protocol defines, so nothing was attempted. */
  malformedRequest: 'ARQFS_WORKER_MALFORMED_REQUEST',
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

/**
 * V3-031: an import rejection keeps its reason on the way out.
 *
 * The worker protocol has carried a `code` field since it was written, and
 * every rejection reaching it was `IMPORT_WORKER_FAILED` with a prose message,
 * because the ingress layer threw bare `Error`s and the handler had nothing
 * else to read. Seven structurally different refusals arrived at the caller
 * looking identical.
 *
 * They are not identical, and the one that matters most is the least visible.
 * "Source hash changed between acquisition and conversion" means the bytes
 * changed underneath an import that was already in progress - a time-of-check
 * to time-of-use condition, whatever caused it - and it reached the caller
 * indistinguishable from "adapter unavailable", which is a configuration
 * mistake. A surface cannot warn about the first and quietly retry the second
 * when both arrive under one code, so it does neither, and the interesting one
 * is the one that gets lost.
 *
 * Codes rather than message matching: a caller that switched on prose would
 * break the first time somebody improved the wording, which is exactly the
 * pressure that makes people leave the wording bad.
 */

export const IMPORT_REJECTION_CODES = {
  /** The bytes are not the length the descriptor promised. */
  sourceLengthChanged: 'ARQ_IMPORT_SOURCE_LENGTH_CHANGED',
  /** The bytes hash differently than when they were acquired. */
  sourceDigestChanged: 'ARQ_IMPORT_SOURCE_DIGEST_CHANGED',
  sourceTooLarge: 'ARQ_IMPORT_SOURCE_TOO_LARGE',
  deadlineExpired: 'ARQ_IMPORT_DEADLINE_EXPIRED',
  tooManyStagedElements: 'ARQ_IMPORT_TOO_MANY_STAGED_ELEMENTS',
  adapterUnavailable: 'ARQ_IMPORT_ADAPTER_UNAVAILABLE',
  adapterRouteMismatch: 'ARQ_IMPORT_ADAPTER_ROUTE_MISMATCH',
  nativeFileMisrouted: 'ARQ_IMPORT_NATIVE_FILE_MISROUTED',
  /** The request was not a shape the worker protocol defines, so nothing was attempted. */
  malformedRequest: 'ARQ_IMPORT_MALFORMED_REQUEST',
} as const;

export type ImportRejectionCode =
  (typeof IMPORT_REJECTION_CODES)[keyof typeof IMPORT_REJECTION_CODES];

/**
 * A refusal that knows why it refused.
 *
 * An `Error` subclass rather than a returned union because the throw sites are
 * spread through a pipeline whose intermediate steps have no useful "rejected"
 * value to return - and converting the whole pipeline to a result type to carry
 * one field would be a much larger change than the problem warrants.
 */
export class ImportRejection extends Error {
  readonly code: ImportRejectionCode;

  constructor(code: ImportRejectionCode, message: string) {
    super(message);
    this.name = 'ImportRejection';
    this.code = code;
  }
}

/**
 * The code to report for a thrown value.
 *
 * Anything that is not an `ImportRejection` keeps the generic code, which is
 * honest: an error nobody classified is an error nobody has decided how to
 * handle, and giving it a specific code would claim otherwise.
 */
export function importRejectionCode(error: unknown, fallback: string): string {
  return error instanceof ImportRejection ? error.code : fallback;
}

/**
 * Whether a rejection means the source changed under an import in progress.
 *
 * Named rather than left to callers comparing codes, because this is the one a
 * surface must not treat as an ordinary retryable failure: retrying reads
 * whatever the bytes are now, which is the situation that produced the
 * mismatch.
 */
export function isSourceIntegrityRejection(code: string): boolean {
  return (
    code === IMPORT_REJECTION_CODES.sourceLengthChanged ||
    code === IMPORT_REJECTION_CODES.sourceDigestChanged
  );
}

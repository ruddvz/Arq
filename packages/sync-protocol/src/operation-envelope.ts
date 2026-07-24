/**
 * ARQ-206: operation envelope and server sequence (ADR-0021 - "sync typed
 * operations and content-addressed resources. Never sync raw SQLite pages.").
 *
 * `payload` is deliberately `unknown` here, not one of @arq/operations's or
 * @arq/arqscript's concrete command types - this package has no opinion on what an
 * operation actually does, only on how operations move between a client replica and
 * a server. Keeping it decoupled avoids a circular/needless dependency and lets any
 * typed-operation source (arqscript, the future operations-sync bridge) use the same
 * envelope.
 */
export interface OperationEnvelope {
  /** Stable idempotency key - the same client-generated ID on a retried upload lets the server recognise a duplicate rather than reapplying it (ARQ-207). */
  readonly operationId: string;
  readonly clientId: string;
  /** Monotonically increasing per client, assigned by the client before this operation is sent - detects gaps/out-of-order delivery, not itself the canonical order. */
  readonly clientSequence: number;
  /** The project revision this operation was authored against - what a server-side rebase (ARQ-209) reconciles against. */
  readonly baseRevision: number;
  readonly payload: unknown;
}

/** Assigned by the server only, once an envelope is accepted - the canonical, project-wide ordering every replica reconciles to. Never assigned by a client. */
export interface ServerSequencedOperation {
  readonly envelope: OperationEnvelope;
  readonly serverSequence: number;
  readonly acceptedAtUnixMs: number;
}

export interface CreateOperationEnvelopeInput {
  readonly operationId: string;
  readonly clientId: string;
  readonly clientSequence: number;
  readonly baseRevision: number;
  readonly payload: unknown;
}

export type CreateOperationEnvelopeResult =
  | { readonly status: 'created'; readonly envelope: OperationEnvelope }
  | { readonly status: 'rejected'; readonly reason: string };

/**
 * Validates the envelope's own structural invariants only - it has no way to check
 * baseRevision against a real project (that is the server/rebase's job, ARQ-209).
 * Never throws for invalid input; a malformed envelope is a 'rejected' result.
 */
export function createOperationEnvelope(
  input: CreateOperationEnvelopeInput,
): CreateOperationEnvelopeResult {
  if (input.operationId.trim() === '') {
    return { status: 'rejected', reason: 'operationId must not be empty' };
  }
  if (input.clientId.trim() === '') {
    return { status: 'rejected', reason: 'clientId must not be empty' };
  }
  if (!Number.isInteger(input.clientSequence) || input.clientSequence < 0) {
    return { status: 'rejected', reason: 'clientSequence must be a non-negative integer' };
  }
  if (!Number.isInteger(input.baseRevision) || input.baseRevision < 0) {
    return { status: 'rejected', reason: 'baseRevision must be a non-negative integer' };
  }
  return {
    status: 'created',
    envelope: {
      operationId: input.operationId,
      clientId: input.clientId,
      clientSequence: input.clientSequence,
      baseRevision: input.baseRevision,
      payload: input.payload,
    },
  };
}

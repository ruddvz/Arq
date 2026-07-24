import type { OperationEnvelope, ServerSequencedOperation } from './operation-envelope';

/**
 * ARQ-207: idempotent operation upload. A pure, in-memory reference model for the
 * server-side accept/dedupe logic - there is no real network server yet (apps/api is
 * still a stub), so this is what a future real server implementation must behave
 * like, verified here as testable logic rather than left undefined.
 */
export type SubmitOperationResult =
  | { readonly status: 'accepted'; readonly operation: ServerSequencedOperation }
  | { readonly status: 'duplicate'; readonly operation: ServerSequencedOperation }
  | { readonly status: 'rejected'; readonly reason: string };

export interface IdempotentOperationStore {
  /**
   * Submitting the exact same operationId with the exact same envelope content
   * twice (e.g. a client retry after a dropped response) returns the original
   * 'duplicate' result rather than reprocessing - this is what makes upload safe to
   * retry. Submitting the same operationId with *different* content is rejected
   * rather than silently returning the first result, since that mismatch means
   * either a real bug or a spoofed idempotency key, not a legitimate retry.
   */
  submit(envelope: OperationEnvelope): SubmitOperationResult;
  readonly acceptedCount: number;
}

function envelopesMatch(a: OperationEnvelope, b: OperationEnvelope): boolean {
  return (
    a.clientId === b.clientId &&
    a.clientSequence === b.clientSequence &&
    a.baseRevision === b.baseRevision &&
    JSON.stringify(a.payload) === JSON.stringify(b.payload)
  );
}

export function createIdempotentOperationStore(): IdempotentOperationStore {
  const byOperationId = new Map<string, ServerSequencedOperation>();
  let nextServerSequence = 1;

  return {
    submit(envelope: OperationEnvelope): SubmitOperationResult {
      const existing = byOperationId.get(envelope.operationId);
      if (existing) {
        if (!envelopesMatch(existing.envelope, envelope)) {
          return {
            status: 'rejected',
            reason: `operationId ${envelope.operationId} was already accepted with different content`,
          };
        }
        return { status: 'duplicate', operation: existing };
      }

      const accepted: ServerSequencedOperation = {
        envelope,
        serverSequence: nextServerSequence++,
        acceptedAtUnixMs: Date.now(),
      };
      byOperationId.set(envelope.operationId, accepted);
      return { status: 'accepted', operation: accepted };
    },
    get acceptedCount(): number {
      return byOperationId.size;
    },
  };
}

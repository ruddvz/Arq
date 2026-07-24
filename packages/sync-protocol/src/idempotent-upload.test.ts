import { describe, expect, it } from 'vitest';
import { createIdempotentOperationStore } from './idempotent-upload';
import type { OperationEnvelope } from './operation-envelope';

function envelope(overrides: Partial<OperationEnvelope> = {}): OperationEnvelope {
  return {
    operationId: 'op-1',
    clientId: 'client-a',
    clientSequence: 0,
    baseRevision: 0,
    payload: { kind: 'CreateWall' },
    ...overrides,
  };
}

describe('createIdempotentOperationStore', () => {
  it('accepts a new operation and assigns serverSequence starting at 1', () => {
    const store = createIdempotentOperationStore();
    const result = store.submit(envelope());
    expect(result.status).toBe('accepted');
    expect(result.status === 'accepted' && result.operation.serverSequence).toBe(1);
  });

  it('a retried upload of the exact same envelope is a duplicate with the SAME serverSequence, not reprocessed', () => {
    const store = createIdempotentOperationStore();
    const first = store.submit(envelope());
    const retry = store.submit(envelope());

    expect(retry.status).toBe('duplicate');
    expect(
      first.status === 'accepted' && retry.status === 'duplicate' && retry.operation.serverSequence,
    ).toBe(first.status === 'accepted' ? first.operation.serverSequence : -1);
    expect(store.acceptedCount).toBe(1);
  });

  it('rejects the same operationId reused with different content, rather than silently returning the first result', () => {
    const store = createIdempotentOperationStore();
    store.submit(envelope({ payload: { kind: 'CreateWall' } }));
    const result = store.submit(envelope({ payload: { kind: 'DeleteWall' } }));

    expect(result).toEqual({
      status: 'rejected',
      reason: expect.stringContaining('different content'),
    });
  });

  it('assigns strictly increasing serverSequence across distinct operations, in submission order', () => {
    const store = createIdempotentOperationStore();
    const a = store.submit(envelope({ operationId: 'op-a' }));
    const b = store.submit(envelope({ operationId: 'op-b' }));
    const c = store.submit(envelope({ operationId: 'op-c' }));

    const sequences = [a, b, c].map((r) =>
      r.status === 'accepted' ? r.operation.serverSequence : -1,
    );
    expect(sequences).toEqual([1, 2, 3]);
  });

  it('acceptedCount reflects only unique accepted operations, not retries', () => {
    const store = createIdempotentOperationStore();
    store.submit(envelope({ operationId: 'op-a' }));
    store.submit(envelope({ operationId: 'op-a' })); // retry
    store.submit(envelope({ operationId: 'op-b' }));

    expect(store.acceptedCount).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import { computeSafeRebasePlan, type RebaseCandidate } from './safe-rebase';

function op(
  operationId: string,
  writes: readonly string[] = [],
  deletes: readonly string[] = [],
): RebaseCandidate {
  return { operationId, touched: { writes: new Set(writes), deletes: new Set(deletes) } };
}

describe('computeSafeRebasePlan', () => {
  it('is safe-to-rebase for every client operation when there are no server operations since base', () => {
    const plan = computeSafeRebasePlan([op('client-1', ['wall-1'])], []);
    expect(plan).toEqual([{ operationId: 'client-1', status: 'safe-to-rebase' }]);
  });

  it('is safe-to-rebase when client and server operations touch disjoint entities', () => {
    const plan = computeSafeRebasePlan([op('client-1', ['wall-1'])], [op('server-1', ['wall-2'])]);
    expect(plan).toEqual([{ operationId: 'client-1', status: 'safe-to-rebase' }]);
  });

  it('is conflicted (concurrent-write) when a client operation writes the same entity a server operation wrote', () => {
    const plan = computeSafeRebasePlan([op('client-1', ['wall-1'])], [op('server-1', ['wall-1'])]);
    expect(plan).toEqual([
      {
        operationId: 'client-1',
        status: 'conflicted',
        conflictClass: 'concurrent-write',
        conflictingServerOperationId: 'server-1',
      },
    ]);
  });

  it('is conflicted (write-after-delete) when a server operation deleted an entity the client wrote to', () => {
    const plan = computeSafeRebasePlan(
      [op('client-1', ['wall-1'])],
      [op('server-1', [], ['wall-1'])],
    );
    expect(plan[0]).toMatchObject({ status: 'conflicted', conflictClass: 'write-after-delete' });
  });

  it('classifies each client operation independently - one conflicting does not mark an unrelated one as conflicted', () => {
    const plan = computeSafeRebasePlan(
      [op('client-1', ['wall-1']), op('client-2', ['wall-99'])],
      [op('server-1', ['wall-1'])],
    );
    expect(plan).toEqual([
      {
        operationId: 'client-1',
        status: 'conflicted',
        conflictClass: 'concurrent-write',
        conflictingServerOperationId: 'server-1',
      },
      { operationId: 'client-2', status: 'safe-to-rebase' },
    ]);
  });

  it('reports the first conflicting server operation when a client operation conflicts with more than one', () => {
    const plan = computeSafeRebasePlan(
      [op('client-1', ['wall-1'])],
      [op('server-1', ['wall-99']), op('server-2', ['wall-1'])],
    );
    expect(plan[0]).toMatchObject({
      status: 'conflicted',
      conflictingServerOperationId: 'server-2',
    });
  });

  it('an empty client operation list produces an empty plan', () => {
    expect(computeSafeRebasePlan([], [op('server-1', ['wall-1'])])).toEqual([]);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createLocalDatabase, type ArqLocalDatabase } from './database';
import { isQuotaExceededError, retryAfterPruning } from './quota-error';
import { appendOperationRecord } from './journal-append';

let openDatabases: ArqLocalDatabase[] = [];

function openTestDatabase(name: string): ArqLocalDatabase {
  const db = createLocalDatabase(name, { indexedDB, IDBKeyRange });
  openDatabases.push(db);
  return db;
}

afterEach(() => {
  for (const db of openDatabases) {
    db.close();
  }
  openDatabases = [];
});

describe('isQuotaExceededError', () => {
  it('recognizes a DOMException named QuotaExceededError', () => {
    expect(isQuotaExceededError(new DOMException('full', 'QuotaExceededError'))).toBe(true);
  });

  it('recognizes any error-like object with that name', () => {
    expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true);
  });

  it('returns false for an unrelated error', () => {
    expect(isQuotaExceededError(new Error('something else'))).toBe(false);
    expect(isQuotaExceededError(new DOMException('closed', 'InvalidStateError'))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
    expect(isQuotaExceededError('a string')).toBe(false);
  });
});

describe('retryAfterPruning', () => {
  it('prunes stale journal entries and reports how many, then runs the retry', async () => {
    const db = openTestDatabase('quota-retry');
    await db.operationJournal.add({
      projectId: 'p1',
      operationId: 'op-old',
      actorId: 'user-1',
      operationType: 'CreateElement',
      baseRevision: 0,
      payload: {},
      preconditions: [],
      affectedElementIds: [],
      createdAt: '2026-07-22T00:00:00.000Z',
    });
    const retryWrite = vi.fn().mockResolvedValue('retried-ok');
    const outcome = await retryAfterPruning(db, 'p1', 10, retryWrite);
    expect(outcome.prunedCount).toBe(1);
    expect(outcome.result).toBe('retried-ok');
    expect(retryWrite).toHaveBeenCalledTimes(1);
  });

  it('composes with appendOperationRecord to recover from a simulated quota failure', async () => {
    const db = openTestDatabase('quota-retry-append');
    await db.operationJournal.add({
      projectId: 'p1',
      operationId: 'op-old',
      actorId: 'user-1',
      operationType: 'CreateElement',
      baseRevision: 0,
      payload: {},
      preconditions: [],
      affectedElementIds: [],
      createdAt: '2026-07-22T00:00:00.000Z',
    });
    vi.spyOn(db.operationJournal, 'add').mockRejectedValueOnce(
      new DOMException('storage quota exceeded', 'QuotaExceededError'),
    );
    const firstAttempt = await appendOperationRecord(db, {
      projectId: 'p1',
      operationId: 'op-new',
      actorId: 'user-1',
      operationType: 'UpdateProperty',
      baseRevision: 5,
      payload: {},
      preconditions: [],
      affectedElementIds: [],
      createdAt: '2026-07-22T00:00:01.000Z',
    });
    expect(firstAttempt.status).toBe('quota-exceeded');

    const outcome = await retryAfterPruning(db, 'p1', 5, () =>
      appendOperationRecord(db, {
        projectId: 'p1',
        operationId: 'op-new',
        actorId: 'user-1',
        operationType: 'UpdateProperty',
        baseRevision: 5,
        payload: {},
        preconditions: [],
        affectedElementIds: [],
        createdAt: '2026-07-22T00:00:01.000Z',
      }),
    );
    expect(outcome.prunedCount).toBe(1);
    expect(outcome.result.status).toBe('appended');
  });
});

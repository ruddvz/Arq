import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createLocalDatabase, type ArqLocalDatabase } from './database';
import { appendOperationRecord, onAbnormalClose } from './journal-append';

let openDatabases: ArqLocalDatabase[] = [];

function openTestDatabase(name: string): ArqLocalDatabase {
  const db = createLocalDatabase(name, { indexedDB, IDBKeyRange });
  openDatabases.push(db);
  return db;
}

function record(operationId: string) {
  return {
    projectId: 'p1',
    operationId,
    actorId: 'user-1',
    operationType: 'CreateElement',
    baseRevision: 0,
    payload: {},
    preconditions: [],
    affectedElementIds: [],
    createdAt: '2026-07-22T00:00:00.000Z',
  };
}

afterEach(() => {
  for (const db of openDatabases) {
    try {
      db.close();
    } catch {
      // already closed by the test itself
    }
  }
  openDatabases = [];
});

describe('appendOperationRecord', () => {
  it('returns an appended result with the assigned sequence on success', async () => {
    const db = openTestDatabase('append-success');
    const result = await appendOperationRecord(db, record('op-1'));
    expect(result.status).toBe('appended');
    if (result.status === 'appended') {
      expect(typeof result.sequence).toBe('number');
    }
  });

  it('reports a quota-exceeded failure distinctly from a generic failure', async () => {
    const db = openTestDatabase('append-quota');
    // fake-indexeddb does not enforce real storage quotas, so a quota
    // failure is simulated here by making the underlying write throw a
    // DOMException named QuotaExceededError, exactly as a real browser
    // would when storage is full - this is a deliberate simulation, not
    // a live trigger of an actual browser quota limit.
    vi.spyOn(db.operationJournal, 'add').mockRejectedValueOnce(
      new DOMException('storage quota exceeded', 'QuotaExceededError'),
    );
    const result = await appendOperationRecord(db, record('op-2'));
    expect(result.status).toBe('quota-exceeded');
  });

  it('reports a generic failure for any other error, including writing after an abnormal close', async () => {
    const db = openTestDatabase('append-after-close');
    db.close();
    const result = await appendOperationRecord(db, record('op-3'));
    expect(result.status).toBe('failed');
  });
});

describe('onAbnormalClose', () => {
  it('fires the registered handler when the database closes', () => {
    const db = openTestDatabase('close-handler');
    const handler = vi.fn();
    onAbnormalClose(db, handler);
    db.close();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('the unsubscribe function stops the handler from firing on a later close', () => {
    const dbA = openTestDatabase('close-handler-a');
    const handler = vi.fn();
    const unsubscribe = onAbnormalClose(dbA, handler);
    unsubscribe();
    dbA.close();
    expect(handler).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createLocalDatabase, type ArqLocalDatabase } from './database';
import { appendOperationRecord, onAbnormalClose } from './journal-append';

let openDatabases: ArqLocalDatabase[] = [];
let databaseCounter = 0;

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

describe('appendOperationRecord idempotency', () => {
  /**
   * The replay defect. A bare `add` meant a retried append wrote a second row,
   * and because recovery replays in `++id` order that row lands at the END of
   * the log rather than at its original position - so create-then-delete
   * replays as create-delete-create and reconstructs a document the user never
   * had.
   */
  it('records an operation once, however many times it is appended', async () => {
    const db = openTestDatabase(`idempotency-${(databaseCounter += 1)}`);
    const record = {
      projectId: 'p1',
      operationId: 'add-walls-abc-1',
      actorId: 'local-user',
      operationType: 'add-walls',
      baseRevision: 0,
      payload: { kind: 'add-walls', walls: [{ id: 'w1' }] },
      preconditions: null,
      affectedElementIds: ['w1'],
      createdAt: '2026-08-01T00:00:00.000Z',
    };

    const first = await appendOperationRecord(db, record);
    const second = await appendOperationRecord(db, record);

    expect(first.status).toBe('appended');
    expect(second.status).toBe('duplicate');
    if (first.status === 'appended' && second.status === 'duplicate') {
      expect(second.sequence).toBe(first.sequence);
    }
    expect(await db.operationJournal.where('projectId').equals('p1').count()).toBe(1);
  });

  it('does not treat the same operation id in a different project as a duplicate', async () => {
    const db = openTestDatabase(`idempotency-${(databaseCounter += 1)}`);
    const base = {
      operationId: 'add-walls-abc-1',
      actorId: 'local-user',
      operationType: 'add-walls',
      baseRevision: 0,
      payload: { kind: 'add-walls', walls: [] },
      preconditions: null,
      affectedElementIds: [],
      createdAt: '2026-08-01T00:00:00.000Z',
    };

    expect((await appendOperationRecord(db, { ...base, projectId: 'p1' })).status).toBe('appended');
    expect((await appendOperationRecord(db, { ...base, projectId: 'p2' })).status).toBe('appended');

    expect(await db.operationJournal.count()).toBe(2);
  });

  it('keeps a retried append from changing what recovery reconstructs', async () => {
    const db = openTestDatabase(`idempotency-${(databaseCounter += 1)}`);
    const make = (operationId: string, kind: string, payload: unknown) => ({
      projectId: 'p1',
      operationId,
      actorId: 'local-user',
      operationType: kind,
      baseRevision: 0,
      payload,
      preconditions: null,
      affectedElementIds: ['w1'],
      createdAt: '2026-08-01T00:00:00.000Z',
    });

    const create = make('create-1', 'add-walls', { kind: 'add-walls', walls: [{ id: 'w1' }] });
    await appendOperationRecord(db, create);
    await appendOperationRecord(
      db,
      make('delete-1', 'remove-walls', {
        kind: 'remove-walls',
        wallIds: ['w1'],
      }),
    );
    // The retry of the first append, arriving after the delete.
    await appendOperationRecord(db, create);

    const replayed = await db.operationJournal.orderBy('id').toArray();
    expect(replayed.map((entry) => entry.operationType)).toEqual(['add-walls', 'remove-walls']);
  });
});

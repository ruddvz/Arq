import { afterEach, describe, expect, it } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createLocalDatabase, type ArqLocalDatabase } from './database';

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

describe('ArqLocalDatabase', () => {
  it('stores and retrieves a project snapshot', async () => {
    const db = openTestDatabase('test-snapshots');
    await db.projectSnapshots.add({
      projectId: 'p1',
      revision: 1,
      schemaVersion: 0,
      data: new Uint8Array([1, 2, 3]),
      createdAt: '2026-07-22T00:00:00.000Z',
    });
    const rows = await db.projectSnapshots.where('projectId').equals('p1').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.revision).toBe(1);
  });

  it('stores and retrieves operation journal entries in insertion order', async () => {
    const db = openTestDatabase('test-journal');
    await db.operationJournal.add({
      projectId: 'p1',
      operationId: 'op-1',
      actorId: 'user-1',
      operationType: 'CreateElement',
      baseRevision: 0,
      payload: {},
      preconditions: [],
      affectedElementIds: ['e1'],
      createdAt: '2026-07-22T00:00:00.000Z',
    });
    await db.operationJournal.add({
      projectId: 'p1',
      operationId: 'op-2',
      actorId: 'user-1',
      operationType: 'UpdateProperty',
      baseRevision: 1,
      payload: {},
      preconditions: [],
      affectedElementIds: ['e1'],
      createdAt: '2026-07-22T00:00:01.000Z',
    });
    const rows = await db.operationJournal.where('projectId').equals('p1').sortBy('id');
    expect(rows.map((r) => r.operationId)).toEqual(['op-1', 'op-2']);
  });
});

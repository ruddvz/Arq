import { afterEach, describe, expect, it } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createLocalDatabase, type ArqLocalDatabase } from './database';
import { exportProjectArchive } from './archive-export';

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

describe('exportProjectArchive', () => {
  it('bundles every snapshot and journal entry for the given project, sorted, with an export timestamp', async () => {
    const db = openTestDatabase('export-archive');
    await db.projectSnapshots.add({
      projectId: 'p1',
      revision: 2,
      schemaVersion: 0,
      data: new Uint8Array([1]),
      createdAt: '2026-07-22T00:00:02.000Z',
    });
    await db.projectSnapshots.add({
      projectId: 'p1',
      revision: 1,
      schemaVersion: 0,
      data: new Uint8Array([0]),
      createdAt: '2026-07-22T00:00:01.000Z',
    });
    await db.operationJournal.add({
      projectId: 'p1',
      operationId: 'op-1',
      actorId: 'user-1',
      operationType: 'CreateElement',
      baseRevision: 0,
      payload: {},
      preconditions: [],
      affectedElementIds: [],
      createdAt: '2026-07-22T00:00:00.000Z',
    });
    // a different project's data must not leak into the archive.
    await db.projectSnapshots.add({
      projectId: 'other-project',
      revision: 1,
      schemaVersion: 0,
      data: new Uint8Array([9]),
      createdAt: '2026-07-22T00:00:00.000Z',
    });

    const archive = await exportProjectArchive(db, 'p1', () => '2026-07-22T12:00:00.000Z');
    expect(archive.projectId).toBe('p1');
    expect(archive.exportedAt).toBe('2026-07-22T12:00:00.000Z');
    expect(archive.snapshots.map((s) => s.revision)).toEqual([1, 2]);
    expect(archive.journal.map((j) => j.operationId)).toEqual(['op-1']);
  });

  it('returns empty arrays for a project with no data', async () => {
    const db = openTestDatabase('export-empty');
    const archive = await exportProjectArchive(db, 'nonexistent');
    expect(archive.snapshots).toEqual([]);
    expect(archive.journal).toEqual([]);
  });
});

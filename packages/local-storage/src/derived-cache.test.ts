import { afterEach, describe, expect, it } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createLocalDatabase, type ArqLocalDatabase } from './database';
import { recoverCorruptDerivedCaches, writeDerivedCache } from './derived-cache';

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

describe('writeDerivedCache', () => {
  it('stores an entry with a checksum of its data', async () => {
    const db = openTestDatabase('write-basic');
    await writeDerivedCache(db, 'p1', 'plan-render-cache', new Uint8Array([1, 2, 3]));
    const rows = await db.derivedCaches.where('projectId').equals('p1').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cacheKey).toBe('plan-render-cache');
    expect(rows[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('replaces (does not duplicate) an existing entry for the same projectId+cacheKey', async () => {
    const db = openTestDatabase('write-replace');
    await writeDerivedCache(db, 'p1', 'room-area-cache', new Uint8Array([1]));
    await writeDerivedCache(db, 'p1', 'room-area-cache', new Uint8Array([2, 2]));
    const rows = await db.derivedCaches.where('projectId').equals('p1').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data).toEqual(new Uint8Array([2, 2]));
  });

  it('keeps separate entries for different cache keys on the same project', async () => {
    const db = openTestDatabase('write-multi-key');
    await writeDerivedCache(db, 'p1', 'plan-render-cache', new Uint8Array([1]));
    await writeDerivedCache(db, 'p1', 'room-area-cache', new Uint8Array([2]));
    const rows = await db.derivedCaches.where('projectId').equals('p1').toArray();
    expect(rows).toHaveLength(2);
  });
});

describe('recoverCorruptDerivedCaches', () => {
  it('discards nothing when every entry matches its checksum', async () => {
    const db = openTestDatabase('recover-clean');
    await writeDerivedCache(db, 'p1', 'plan-render-cache', new Uint8Array([1, 2, 3]));
    await writeDerivedCache(db, 'p1', 'room-area-cache', new Uint8Array([4, 5, 6]));
    const report = await recoverCorruptDerivedCaches(db, 'p1');
    expect([...report.checkedCacheKeys].sort()).toEqual(['plan-render-cache', 'room-area-cache']);
    expect(report.discardedCacheKeys).toEqual([]);
    const remaining = await db.derivedCaches.where('projectId').equals('p1').toArray();
    expect(remaining).toHaveLength(2);
  });

  it('discards an entry whose data no longer matches its recorded checksum', async () => {
    const db = openTestDatabase('recover-corrupt');
    await writeDerivedCache(db, 'p1', 'plan-render-cache', new Uint8Array([1, 2, 3]));
    // Simulate corruption: overwrite the row's data directly, bypassing writeDerivedCache
    // (and so its checksum), the same way real on-disk bit rot would leave a stale checksum.
    const row = await db.derivedCaches.where('projectId').equals('p1').first();
    await db.derivedCaches.update(row!.id!, { data: new Uint8Array([9, 9, 9]) });

    const report = await recoverCorruptDerivedCaches(db, 'p1');
    expect(report.discardedCacheKeys).toEqual(['plan-render-cache']);
    const remaining = await db.derivedCaches.where('projectId').equals('p1').toArray();
    expect(remaining).toHaveLength(0);
  });

  it('discards only the corrupt entry, keeping healthy entries intact', async () => {
    const db = openTestDatabase('recover-mixed');
    await writeDerivedCache(db, 'p1', 'plan-render-cache', new Uint8Array([1, 2, 3]));
    await writeDerivedCache(db, 'p1', 'room-area-cache', new Uint8Array([4, 5, 6]));
    const corruptRow = await db.derivedCaches
      .where('[projectId+cacheKey]')
      .equals(['p1', 'plan-render-cache'])
      .first();
    await db.derivedCaches.update(corruptRow!.id!, { data: new Uint8Array([0]) });

    const report = await recoverCorruptDerivedCaches(db, 'p1');
    expect(report.discardedCacheKeys).toEqual(['plan-render-cache']);
    const remaining = await db.derivedCaches.where('projectId').equals('p1').toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.cacheKey).toBe('room-area-cache');
  });

  it('never touches projectSnapshots or operationJournal, even when recovering a corrupt cache', async () => {
    const db = openTestDatabase('recover-no-touch-committed');
    await db.projectSnapshots.add({
      projectId: 'p1',
      revision: 1,
      schemaVersion: 0,
      data: new Uint8Array([7, 7, 7]),
      createdAt: '2026-07-22T00:00:00.000Z',
    });
    await db.operationJournal.add({
      projectId: 'p1',
      operationId: 'op-1',
      actorId: 'user-1',
      operationType: 'UPDATE_PROPERTY',
      baseRevision: 0,
      payload: {},
      preconditions: [],
      affectedElementIds: [],
      createdAt: '2026-07-22T00:00:00.000Z',
    });
    await writeDerivedCache(db, 'p1', 'plan-render-cache', new Uint8Array([1, 2, 3]));
    const corruptRow = await db.derivedCaches.where('projectId').equals('p1').first();
    await db.derivedCaches.update(corruptRow!.id!, { data: new Uint8Array([9]) });

    await recoverCorruptDerivedCaches(db, 'p1');

    const snapshots = await db.projectSnapshots.where('projectId').equals('p1').toArray();
    const journal = await db.operationJournal.where('projectId').equals('p1').toArray();
    expect(snapshots).toHaveLength(1);
    expect(journal).toHaveLength(1);
  });

  it('is a no-op when the project has no derived cache entries', async () => {
    const db = openTestDatabase('recover-empty');
    const report = await recoverCorruptDerivedCaches(db, 'p1');
    expect(report).toEqual({ checkedCacheKeys: [], discardedCacheKeys: [] });
  });
});

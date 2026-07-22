import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createLocalDatabase, type ArqLocalDatabase } from './database';
import { readLatestSnapshot, writeSnapshot } from './snapshot';

let openDatabases: ArqLocalDatabase[] = [];

function openTestDatabase(name: string): ArqLocalDatabase {
  const db = createLocalDatabase(name, { indexedDB, IDBKeyRange });
  openDatabases.push(db);
  return db;
}

function snapshotRecord(projectId: string, revision: number) {
  return {
    projectId,
    revision,
    schemaVersion: 0,
    data: new Uint8Array([revision]),
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

describe('writeSnapshot', () => {
  it('returns a written result with the assigned id on success', async () => {
    const db = openTestDatabase('snapshot-write');
    const result = await writeSnapshot(db, snapshotRecord('p1', 1));
    expect(result.status).toBe('written');
  });

  it('reports quota-exceeded distinctly from a generic failure', async () => {
    const db = openTestDatabase('snapshot-quota');
    vi.spyOn(db.projectSnapshots, 'add').mockRejectedValueOnce(
      new DOMException('storage quota exceeded', 'QuotaExceededError'),
    );
    const result = await writeSnapshot(db, snapshotRecord('p1', 1));
    expect(result.status).toBe('quota-exceeded');
  });

  it('reports a generic failure for writing after an abnormal close', async () => {
    const db = openTestDatabase('snapshot-after-close');
    db.close();
    const result = await writeSnapshot(db, snapshotRecord('p1', 1));
    expect(result.status).toBe('failed');
  });
});

describe('readLatestSnapshot', () => {
  it('returns the highest-revision snapshot for the project', async () => {
    const db = openTestDatabase('snapshot-latest');
    await db.projectSnapshots.add(snapshotRecord('p1', 1));
    await db.projectSnapshots.add(snapshotRecord('p1', 3));
    await db.projectSnapshots.add(snapshotRecord('p1', 2));
    const latest = await readLatestSnapshot(db, 'p1');
    expect(latest?.revision).toBe(3);
  });

  it('returns undefined when the project has no snapshots', async () => {
    const db = openTestDatabase('snapshot-none');
    expect(await readLatestSnapshot(db, 'nonexistent')).toBeUndefined();
  });

  it("does not consider another project's snapshots", async () => {
    const db = openTestDatabase('snapshot-other-project');
    await db.projectSnapshots.add(snapshotRecord('other', 99));
    expect(await readLatestSnapshot(db, 'p1')).toBeUndefined();
  });
});

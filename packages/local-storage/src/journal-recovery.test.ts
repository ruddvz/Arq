import { afterEach, describe, expect, it } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createLocalDatabase, type ArqLocalDatabase } from './database';
import {
  pruneJournalBeforeRevision,
  readJournalSince,
  shouldTakeSnapshot,
} from './journal-recovery';

let openDatabases: ArqLocalDatabase[] = [];

function openTestDatabase(name: string): ArqLocalDatabase {
  const db = createLocalDatabase(name, { indexedDB, IDBKeyRange });
  openDatabases.push(db);
  return db;
}

function record(operationId: string, baseRevision: number) {
  return {
    projectId: 'p1',
    operationId,
    actorId: 'user-1',
    operationType: 'CreateElement',
    baseRevision,
    payload: {},
    preconditions: [],
    affectedElementIds: [],
    createdAt: '2026-07-22T00:00:00.000Z',
  };
}

afterEach(() => {
  for (const db of openDatabases) {
    db.close();
  }
  openDatabases = [];
});

describe('readJournalSince', () => {
  it('returns only entries added after the given sequence', async () => {
    const db = openTestDatabase('journal-since');
    const firstId = await db.operationJournal.add(record('op-1', 0));
    await db.operationJournal.add(record('op-2', 1));
    const entries = await readJournalSince(db, 'p1', firstId);
    expect(entries.map((entry) => entry.operationId)).toEqual(['op-2']);
  });

  it('returns everything when sinceSequence is 0 (no prior snapshot)', async () => {
    const db = openTestDatabase('journal-since-zero');
    await db.operationJournal.add(record('op-1', 0));
    await db.operationJournal.add(record('op-2', 1));
    const entries = await readJournalSince(db, 'p1', 0);
    expect(entries).toHaveLength(2);
  });
});

describe('shouldTakeSnapshot', () => {
  it('is true once the operation-count threshold is reached', () => {
    expect(
      shouldTakeSnapshot({
        operationsSinceLastSnapshot: 100,
        msSinceLastSnapshot: 0,
        operationCountThreshold: 100,
        elapsedMsThreshold: 60_000,
      }),
    ).toBe(true);
  });

  it('is true once the elapsed-time threshold is reached, even with few operations', () => {
    expect(
      shouldTakeSnapshot({
        operationsSinceLastSnapshot: 1,
        msSinceLastSnapshot: 60_000,
        operationCountThreshold: 100,
        elapsedMsThreshold: 60_000,
      }),
    ).toBe(true);
  });

  it('is false when neither threshold is reached', () => {
    expect(
      shouldTakeSnapshot({
        operationsSinceLastSnapshot: 1,
        msSinceLastSnapshot: 1,
        operationCountThreshold: 100,
        elapsedMsThreshold: 60_000,
      }),
    ).toBe(false);
  });
});

describe('pruneJournalBeforeRevision', () => {
  it('deletes only entries whose baseRevision predates the given revision', async () => {
    const db = openTestDatabase('journal-prune');
    await db.operationJournal.add(record('op-old', 0));
    await db.operationJournal.add(record('op-new', 5));
    const removed = await pruneJournalBeforeRevision(db, 'p1', 5);
    expect(removed).toBe(1);
    const remaining = await db.operationJournal.where('projectId').equals('p1').toArray();
    expect(remaining.map((entry) => entry.operationId)).toEqual(['op-new']);
  });

  it("does not touch another project's journal entries", async () => {
    const db = openTestDatabase('journal-prune-other-project');
    await db.operationJournal.add({ ...record('op-1', 0), projectId: 'other' });
    const removed = await pruneJournalBeforeRevision(db, 'p1', 100);
    expect(removed).toBe(0);
    const remaining = await db.operationJournal.toArray();
    expect(remaining).toHaveLength(1);
  });
});

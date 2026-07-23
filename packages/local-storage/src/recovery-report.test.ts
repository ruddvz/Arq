import { afterEach, describe, expect, it } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createLocalDatabase, type ArqLocalDatabase } from './database';
import { computeRecoveryReport } from './recovery-report';

let openDatabases: ArqLocalDatabase[] = [];

function openTestDatabase(name: string): ArqLocalDatabase {
  const db = createLocalDatabase(name, { indexedDB, IDBKeyRange });
  openDatabases.push(db);
  return db;
}

function journalEntry(operationId: string, overrides: Partial<Record<string, unknown>> = {}) {
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
    ...overrides,
  };
}

afterEach(() => {
  for (const db of openDatabases) {
    db.close();
  }
  openDatabases = [];
});

describe('computeRecoveryReport', () => {
  it('reports no snapshot and zero recovered operations for a brand-new project', async () => {
    const db = openTestDatabase('recovery-empty');
    const report = await computeRecoveryReport(db, 'p1');
    expect(report).toEqual({
      projectId: 'p1',
      hasSnapshot: false,
      lastCommittedAt: undefined,
      snapshotRevision: 0,
      recoveredOperationCount: 0,
      incompleteOperations: [],
    });
  });

  it('counts only journal entries whose baseRevision is at or after the snapshot revision as recovered', async () => {
    const db = openTestDatabase('recovery-with-snapshot');
    await db.projectSnapshots.add({
      projectId: 'p1',
      revision: 5,
      schemaVersion: 0,
      data: new Uint8Array(),
      createdAt: '2026-07-22T00:00:00.000Z',
    });
    // already captured by the snapshot (baseRevision < 5) - not recovered.
    await db.operationJournal.add(
      journalEntry('op-old', { baseRevision: 3, createdAt: '2026-07-22T00:00:01.000Z' }),
    );
    // applied on top of the snapshot's revision - recovered.
    await db.operationJournal.add(
      journalEntry('op-1', { baseRevision: 5, createdAt: '2026-07-22T00:01:00.000Z' }),
    );
    await db.operationJournal.add(
      journalEntry('op-2', { baseRevision: 6, createdAt: '2026-07-22T00:02:00.000Z' }),
    );
    const report = await computeRecoveryReport(db, 'p1');
    expect(report.hasSnapshot).toBe(true);
    expect(report.snapshotRevision).toBe(5);
    expect(report.recoveredOperationCount).toBe(2);
    expect(report.lastCommittedAt).toBe('2026-07-22T00:02:00.000Z');
  });

  it('flags a journal entry with an empty operationType as incomplete', async () => {
    const db = openTestDatabase('recovery-incomplete');
    await db.operationJournal.add(journalEntry('op-bad', { operationType: '' }));
    const report = await computeRecoveryReport(db, 'p1');
    expect(report.incompleteOperations).toHaveLength(1);
    expect(report.incompleteOperations[0]?.operationId).toBe('op-bad');
  });

  it('falls back to the snapshot time as lastCommittedAt when there are no journal entries after it', async () => {
    const db = openTestDatabase('recovery-snapshot-only');
    await db.projectSnapshots.add({
      projectId: 'p1',
      revision: 1,
      schemaVersion: 0,
      data: new Uint8Array(),
      createdAt: '2026-07-22T00:00:05.000Z',
    });
    const report = await computeRecoveryReport(db, 'p1');
    expect(report.recoveredOperationCount).toBe(0);
    expect(report.lastCommittedAt).toBe('2026-07-22T00:00:05.000Z');
  });
});

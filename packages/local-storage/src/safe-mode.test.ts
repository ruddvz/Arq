import { describe, expect, it } from 'vitest';
import { resolveSafeModeOpenPlan, safeModeHasDeferredWork } from './safe-mode';
import type { RecoveryReport } from './recovery-report';
import type { LocalOperationJournalRecord } from './database';

function journalEntry(
  overrides: Partial<LocalOperationJournalRecord> = {},
): LocalOperationJournalRecord {
  return {
    projectId: 'p1',
    operationId: 'op-1',
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

function baseReport(overrides: Partial<RecoveryReport> = {}): RecoveryReport {
  return {
    projectId: 'p1',
    hasSnapshot: true,
    lastCommittedAt: '2026-07-22T00:02:00.000Z',
    snapshotRevision: 5,
    recoveredOperationCount: 0,
    incompleteOperations: [],
    ...overrides,
  };
}

describe('resolveSafeModeOpenPlan', () => {
  it('always opens at the snapshot revision, never a later one', () => {
    const plan = resolveSafeModeOpenPlan(
      baseReport({ snapshotRevision: 5, recoveredOperationCount: 3 }),
    );
    expect(plan.openAtRevision).toBe(5);
  });

  it('opens at revision 0 when there is no snapshot yet', () => {
    const plan = resolveSafeModeOpenPlan(baseReport({ hasSnapshot: false, snapshotRevision: 0 }));
    expect(plan.openAtRevision).toBe(0);
  });

  it('defers every recovered operation, including valid ones, not just incomplete ones', () => {
    const plan = resolveSafeModeOpenPlan(
      baseReport({ recoveredOperationCount: 4, incompleteOperations: [] }),
    );
    expect(plan.deferredOperationCount).toBe(4);
  });

  it('reports whether any recovered operation is incomplete', () => {
    const withIncomplete = resolveSafeModeOpenPlan(
      baseReport({
        recoveredOperationCount: 1,
        incompleteOperations: [journalEntry({ operationType: '' })],
      }),
    );
    expect(withIncomplete.hasIncompleteOperations).toBe(true);

    const withoutIncomplete = resolveSafeModeOpenPlan(
      baseReport({ recoveredOperationCount: 1, incompleteOperations: [] }),
    );
    expect(withoutIncomplete.hasIncompleteOperations).toBe(false);
  });

  it('carries the projectId through unchanged', () => {
    const plan = resolveSafeModeOpenPlan(baseReport({ projectId: 'project-xyz' }));
    expect(plan.projectId).toBe('project-xyz');
  });
});

describe('safeModeHasDeferredWork', () => {
  it('is false for a project with nothing recovered', () => {
    const plan = resolveSafeModeOpenPlan(baseReport({ recoveredOperationCount: 0 }));
    expect(safeModeHasDeferredWork(plan)).toBe(false);
  });

  it('is true when at least one operation is deferred', () => {
    const plan = resolveSafeModeOpenPlan(baseReport({ recoveredOperationCount: 1 }));
    expect(safeModeHasDeferredWork(plan)).toBe(true);
  });
});

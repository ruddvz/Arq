import { describe, expect, it } from 'vitest';
import {
  planFromEntries,
  hasRecoverableWork,
  applyRecoveryPlan,
  validateRecoveredState,
  type RecoveryPlan,
  type RecoveryApplyOutcome,
} from './recovery-plan';
import type { ArqLocalDatabase, LocalOperationJournalRecord } from './database';

function entry(
  overrides: Partial<LocalOperationJournalRecord> & { readonly baseRevision: number },
): LocalOperationJournalRecord {
  return {
    projectId: 'p1',
    operationId: `op-${overrides.baseRevision}-${overrides.operationId ?? '0'}`,
    actorId: 'user-1',
    operationType: 'create-wall',
    payload: {},
    preconditions: {},
    affectedElementIds: ['w1'],
    createdAt: '2026-08-05T00:00:00.000Z',
    ...overrides,
  };
}

/** A stand-in for the Dexie table surface `applyRecoveryPlan` actually uses. */
function fakeDb(entries: readonly LocalOperationJournalRecord[]): ArqLocalDatabase {
  return {
    operationJournal: {
      where: () => ({
        equals: () => ({
          sortBy: async () => [...entries],
        }),
      }),
    },
  } as unknown as ArqLocalDatabase;
}

describe('planFromEntries', () => {
  it('reports nothing to recover for an empty journal', () => {
    const plan = planFromEntries('p1', 7, []);
    expect(plan.disposition).toBe('none');
    expect(hasRecoverableWork(plan)).toBe(false);
  });

  it('reports operations built on the canonical revision as available for review', () => {
    const plan = planFromEntries('p1', 7, [
      entry({ baseRevision: 7, operationId: 'a' }),
      entry({ baseRevision: 7, operationId: 'b' }),
    ]);

    expect(plan.disposition).toBe('available');
    expect(plan.replayableCount).toBe(2);
    expect(hasRecoverableWork(plan)).toBe(true);
  });

  /**
   * The whole point of the plan/apply split: detecting recovery must never be
   * able to authorise it.
   */
  it('never authorises its own application', () => {
    const plan = planFromEntries('p1', 7, [entry({ baseRevision: 7 })]);
    expect(plan.autoApply).toBe(false);
  });

  it('treats a journal entirely older than the working copy as already incorporated', () => {
    const plan = planFromEntries('p1', 7, [
      entry({ baseRevision: 5, operationId: 'a' }),
      entry({ baseRevision: 6, operationId: 'b' }),
    ]);

    expect(plan.disposition).toBe('superseded');
    expect(plan.supersededCount).toBe(2);
    expect(plan.replayableCount).toBe(0);
    expect(hasRecoverableWork(plan)).toBe(false);
  });

  /**
   * The working copy went backwards - restored from an older publication, or
   * replaced - so the journal assumes revisions that no longer exist. Replaying
   * would apply edits onto state they were never validated against.
   */
  it('refuses a journal built on a revision the working copy does not have', () => {
    const plan = planFromEntries('p1', 7, [entry({ baseRevision: 9 })]);

    expect(plan.disposition).toBe('divergent');
    expect(plan.replayableCount).toBe(0);
    expect(hasRecoverableWork(plan)).toBe(false);
  });

  /**
   * The subtle case: some entries line up and some are ahead. Replaying only
   * the matching subset would commit a partial history and produce a state
   * neither tier ever had, so the whole journal is divergent.
   */
  it('refuses the whole journal when only part of it is ahead', () => {
    const plan = planFromEntries('p1', 7, [
      entry({ baseRevision: 7, operationId: 'a' }),
      entry({ baseRevision: 9, operationId: 'b' }),
    ]);

    expect(plan.disposition).toBe('divergent');
    expect(plan.replayableCount).toBe(0);
  });

  it('refuses a journal belonging to a different project', () => {
    const plan = planFromEntries('p1', 7, [entry({ baseRevision: 7, projectId: 'p2' })]);

    expect(plan.disposition).toBe('foreign');
    expect(plan.replayableCount).toBe(0);
    expect(plan.operations).toEqual([]);
  });

  it('bounds the review list and says so rather than truncating silently', () => {
    const many = Array.from({ length: 250 }, (_, index) =>
      entry({ baseRevision: 7, operationId: String(index) }),
    );
    const plan = planFromEntries('p1', 7, many);

    expect(plan.replayableCount).toBe(250);
    expect(plan.operations).toHaveLength(200);
    expect(plan.truncated).toBe(true);
  });

  it('bounds the affected element list', () => {
    const many = Array.from({ length: 600 }, (_, index) =>
      entry({
        baseRevision: 7,
        operationId: String(index),
        affectedElementIds: [`element-${index}`],
      }),
    );
    const plan = planFromEntries('p1', 7, many);

    expect(plan.affectedElementIds.length).toBeLessThanOrEqual(500);
  });

  it('deduplicates elements touched by several operations', () => {
    const plan = planFromEntries('p1', 7, [
      entry({ baseRevision: 7, operationId: 'a', affectedElementIds: ['w1', 'w2'] }),
      entry({ baseRevision: 7, operationId: 'b', affectedElementIds: ['w2', 'w3'] }),
    ]);

    expect([...plan.affectedElementIds].sort()).toEqual(['w1', 'w2', 'w3']);
  });

  it('reports the highest journalled base revision so the split can be described', () => {
    const plan = planFromEntries('p1', 7, [
      entry({ baseRevision: 5, operationId: 'a' }),
      entry({ baseRevision: 7, operationId: 'b' }),
    ]);

    expect(plan.highestJournalledBaseRevision).toBe(7);
  });
});

describe('applyRecoveryPlan', () => {
  it('replays every journalled operation through the caller’s operation path', async () => {
    const entries = [
      entry({ baseRevision: 7, operationId: 'a' }),
      entry({ baseRevision: 7, operationId: 'b' }),
    ];
    const plan = planFromEntries('p1', 7, entries);
    const applied: string[] = [];

    const outcome = await applyRecoveryPlan(fakeDb(entries), plan, async (record) => {
      applied.push(record.operationId);
      return { status: 'committed', revision: 7 + applied.length };
    });

    expect(outcome).toEqual({ status: 'recovered', appliedCount: 2, revision: 9 });
    expect(applied).toEqual(entries.map((e) => e.operationId));
  });

  /**
   * The plan's operation list is capped for display. Replaying only what was
   * displayed would silently drop the rest of the user's work.
   */
  it('replays past the review limit rather than only what the plan displayed', async () => {
    const entries = Array.from({ length: 250 }, (_, index) =>
      entry({ baseRevision: 7, operationId: String(index) }),
    );
    const plan = planFromEntries('p1', 7, entries);
    expect(plan.operations).toHaveLength(200);

    let count = 0;
    const outcome = await applyRecoveryPlan(fakeDb(entries), plan, async () => {
      count += 1;
      return { status: 'committed', revision: 7 + count };
    });

    expect(outcome.status).toBe('recovered');
    expect(count).toBe(250);
  });

  it('stops at the first rejection and reports the real split', async () => {
    const first = entry({ baseRevision: 7, operationId: 'a' });
    const second = entry({ baseRevision: 7, operationId: 'b' });
    const third = entry({ baseRevision: 7, operationId: 'c' });
    const entries = [first, second, third];
    const plan = planFromEntries('p1', 7, entries);
    const applied: string[] = [];

    const outcome = await applyRecoveryPlan(fakeDb(entries), plan, async (record) => {
      if (record.operationId === second.operationId) {
        return { status: 'rejected', reason: 'precondition failed' };
      }
      applied.push(record.operationId);
      return { status: 'committed', revision: 8 };
    });

    expect(outcome).toMatchObject({
      status: 'failed',
      appliedCount: 1,
      failedOperationId: second.operationId,
      detail: 'precondition failed',
    });
    // The third operation is never attempted: its preconditions were never
    // checked against a state where the second did not apply.
    expect(applied).toEqual([first.operationId]);
  });

  it('refuses to replay a divergent journal', async () => {
    const entries = [entry({ baseRevision: 9 })];
    const plan = planFromEntries('p1', 7, entries);
    let called = false;

    const outcome = await applyRecoveryPlan(fakeDb(entries), plan, async () => {
      called = true;
      return { status: 'committed', revision: 8 };
    });

    expect(outcome).toEqual({ status: 'refused', reason: 'divergent' });
    expect(called).toBe(false);
  });

  it('refuses to replay a foreign journal', async () => {
    const entries = [entry({ baseRevision: 7, projectId: 'p2' })];
    const plan = planFromEntries('p1', 7, entries);

    const outcome = await applyRecoveryPlan(fakeDb(entries), plan, async () => ({
      status: 'committed',
      revision: 8,
    }));

    expect(outcome).toEqual({ status: 'refused', reason: 'foreign' });
  });
});

describe('validateRecoveredState', () => {
  const cleanPlan: RecoveryPlan = planFromEntries('p1', 9, []);

  it('passes when the replay agrees with the working copy and nothing is left over', () => {
    const outcome: RecoveryApplyOutcome = { status: 'recovered', appliedCount: 2, revision: 9 };
    expect(validateRecoveredState(outcome, 9, cleanPlan)).toEqual({ ok: true, reasons: [] });
  });

  /**
   * "Recovered" must not be allowed to mean "the replay did not throw".
   */
  it('fails when the replay reports a revision the working copy does not agree with', () => {
    const outcome: RecoveryApplyOutcome = { status: 'recovered', appliedCount: 2, revision: 9 };
    const result = validateRecoveredState(outcome, 8, cleanPlan);

    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/revision 9 .* is on 8/);
  });

  it('fails when journalled work still is not in the working copy', () => {
    const outcome: RecoveryApplyOutcome = { status: 'recovered', appliedCount: 1, revision: 9 };
    const leftover = planFromEntries('p1', 9, [entry({ baseRevision: 9 })]);

    const result = validateRecoveredState(outcome, 9, leftover);

    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/still are not in the working copy/);
  });

  it('fails when the replay itself did not complete', () => {
    const outcome: RecoveryApplyOutcome = {
      status: 'failed',
      appliedCount: 1,
      failedOperationId: 'op-a',
      detail: 'rejected',
    };

    expect(validateRecoveredState(outcome, 9, cleanPlan).ok).toBe(false);
  });

  it('fails when the journal diverged during the replay', () => {
    const outcome: RecoveryApplyOutcome = { status: 'recovered', appliedCount: 1, revision: 9 };
    const diverged = planFromEntries('p1', 9, [entry({ baseRevision: 11 })]);

    const result = validateRecoveredState(outcome, 9, diverged);

    expect(result.ok).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/diverged/);
  });
});

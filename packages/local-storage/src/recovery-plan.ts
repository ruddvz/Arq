import type { ArqLocalDatabase, LocalOperationJournalRecord } from './database';

/**
 * V3-058 to V3-062: deciding what the device-local recovery journal is owed
 * against the canonical working copy, without ever acting on that decision here.
 *
 * ADR-0030 gives the two tiers different authority: the OPFS working copy is
 * canonical, and the Dexie journal is an append-only device-local record of
 * operations that may not have reached it. The dangerous moment is the gap
 * between them. A journal holding work the working copy does not have is the
 * user's unsaved changes; replaying it silently would apply edits they never
 * asked to re-apply, and refusing to mention it would lose them.
 *
 * So this module only ever *reports*. `buildRecoveryPlan` is a pure read that
 * returns a disposition and a bounded description of the difference;
 * `RecoveryPlan.autoApply` is the literal type `false`, so no caller can
 * construct a plan that authorises itself. Applying is a separate, explicitly
 * consented call that routes every operation through the caller's operation
 * path rather than writing to the database directly.
 */

/** How much of the journal a plan will describe. */
const REVIEW_LIMIT = 200;

/** How many distinct element ids a plan will name before it stops collecting. */
const AFFECTED_ELEMENT_LIMIT = 500;

export type RecoveryDisposition =
  /** The journal holds nothing the working copy does not already have. */
  | 'none'
  /** Operations built on exactly the canonical revision are waiting. Reviewable and replayable. */
  | 'available'
  /**
   * Every journalled operation predates the canonical revision, so the working
   * copy already incorporates them. Nothing to recover, and the journal can be
   * pruned.
   */
  | 'superseded'
  /**
   * The journal was built on a revision *newer* than the working copy's. The
   * working copy has gone backwards - restored from an older publication,
   * replaced, or opened on a different device - so the intermediate revisions
   * these operations assume are missing. Replaying them would apply edits on
   * top of state they were never validated against, which is how a replay
   * silently corrupts a project rather than restoring it.
   */
  | 'divergent'
  /** The journal belongs to a different project. Never replayable here. */
  | 'foreign';

export interface RecoveryOperationSummary {
  readonly operationId: string;
  readonly operationType: string;
  readonly baseRevision: number;
  readonly actorId: string;
  readonly createdAt: string;
  readonly affectedElementIds: readonly string[];
}

export interface RecoveryPlan {
  readonly disposition: RecoveryDisposition;
  readonly projectId: string;
  /** The working copy's committed revision, as supplied by the canonical tier. */
  readonly canonicalRevision: number;
  /** Operations that would be replayed. Zero unless the disposition is 'available'. */
  readonly replayableCount: number;
  /** Journalled operations the working copy already has. */
  readonly supersededCount: number;
  /** The highest base revision any journal entry was built on. */
  readonly highestJournalledBaseRevision: number | null;
  /** A bounded sample for review, oldest first. See `truncated`. */
  readonly operations: readonly RecoveryOperationSummary[];
  /** Distinct elements the replayable operations touch, bounded. */
  readonly affectedElementIds: readonly string[];
  /** True when the journal is larger than this plan describes. */
  readonly truncated: boolean;
  /**
   * Always `false`, as a type rather than a value. Recovery is never automatic:
   * a plan that could carry `true` would let a caller construct its own consent.
   */
  readonly autoApply: false;
}

/**
 * Reads the journal and reports what recovery is owed. Applies nothing, writes
 * nothing, and prunes nothing.
 *
 * `canonicalRevision` comes from the working copy the Worker opened, so this
 * module needs no dependency on the canonical tier - the comparison is a plain
 * number, and the package boundary in ADR-0030 stays intact.
 */
export async function buildRecoveryPlan(
  db: ArqLocalDatabase,
  projectId: string,
  canonicalRevision: number,
): Promise<RecoveryPlan> {
  const entries = await db.operationJournal.where('projectId').equals(projectId).sortBy('id');
  return planFromEntries(projectId, canonicalRevision, entries);
}

/**
 * The pure core, exported so the decision can be tested against hand-built
 * journals without a database and reused by a caller that already holds the
 * entries.
 */
export function planFromEntries(
  projectId: string,
  canonicalRevision: number,
  entries: readonly LocalOperationJournalRecord[],
): RecoveryPlan {
  const foreign = entries.filter((entry) => entry.projectId !== projectId);
  if (foreign.length > 0) {
    // A journal naming another project cannot describe this one's history at
    // all, so no count from it is meaningful. Report and stop.
    return emptyPlan('foreign', projectId, canonicalRevision);
  }

  const superseded = entries.filter((entry) => entry.baseRevision < canonicalRevision);
  const replayable = entries.filter((entry) => entry.baseRevision === canonicalRevision);
  const ahead = entries.filter((entry) => entry.baseRevision > canonicalRevision);

  const highestJournalledBaseRevision = entries.reduce<number | null>(
    (highest, entry) =>
      highest === null || entry.baseRevision > highest ? entry.baseRevision : highest,
    null,
  );

  // Checked before 'available': a journal containing operations built on a
  // revision the working copy does not have is divergent even if some of its
  // other entries happen to line up. Replaying the matching subset would apply
  // a partial history and produce a state neither tier ever had.
  if (ahead.length > 0) {
    return {
      ...emptyPlan('divergent', projectId, canonicalRevision),
      supersededCount: superseded.length,
      highestJournalledBaseRevision,
      operations: summarise(ahead),
      truncated: ahead.length > REVIEW_LIMIT,
    };
  }

  if (replayable.length === 0) {
    return {
      ...emptyPlan(superseded.length > 0 ? 'superseded' : 'none', projectId, canonicalRevision),
      supersededCount: superseded.length,
      highestJournalledBaseRevision,
    };
  }

  return {
    disposition: 'available',
    projectId,
    canonicalRevision,
    replayableCount: replayable.length,
    supersededCount: superseded.length,
    highestJournalledBaseRevision,
    operations: summarise(replayable),
    affectedElementIds: collectAffectedElementIds(replayable),
    truncated: replayable.length > REVIEW_LIMIT,
    autoApply: false,
  };
}

/** Whether a plan describes work a user could choose to restore. */
export function hasRecoverableWork(plan: RecoveryPlan): boolean {
  return plan.disposition === 'available' && plan.replayableCount > 0;
}

export type RecoveryApplyOutcome =
  | { readonly status: 'recovered'; readonly appliedCount: number; readonly revision: number }
  /** The plan did not describe replayable work, so there was nothing to consent to. */
  | { readonly status: 'refused'; readonly reason: RecoveryDisposition | 'not-replayable' }
  /**
   * An operation was rejected mid-replay. `appliedCount` is how many committed
   * before the stop, so the caller can report the real split rather than
   * implying all or nothing.
   */
  | {
      readonly status: 'failed';
      readonly appliedCount: number;
      readonly failedOperationId: string;
      readonly detail: string;
    };

/**
 * One journalled operation handed back to the caller's operation pipeline.
 * Returning a revision means the operation committed; returning a rejection
 * means it did not, and replay stops there.
 */
export type RecoveryOperationApplier = (record: LocalOperationJournalRecord) => Promise<
  | { readonly status: 'committed'; readonly revision: number }
  | {
      readonly status: 'rejected';
      readonly reason: string;
    }
>;

/**
 * Replays a reviewed plan through `apply`, one operation at a time, in journal
 * order.
 *
 * The applier is injected rather than implemented here because recovery must
 * not be a second way to write to a project. Replay goes through the same typed
 * operation path as a live edit - same validation, same preconditions, same
 * revision advance - so an operation that would be refused today is refused on
 * replay too, instead of being trusted because it is old.
 *
 * Replay stops at the first rejection. Continuing past one would apply later
 * operations onto state their preconditions were never checked against, which
 * is the same partial-history hazard the divergent disposition exists to
 * prevent.
 */
export async function applyRecoveryPlan(
  db: ArqLocalDatabase,
  plan: RecoveryPlan,
  apply: RecoveryOperationApplier,
): Promise<RecoveryApplyOutcome> {
  if (plan.disposition !== 'available') {
    return { status: 'refused', reason: plan.disposition };
  }
  if (plan.replayableCount === 0) {
    return { status: 'refused', reason: 'not-replayable' };
  }

  // Re-read rather than trusting the plan's bounded sample: the plan caps its
  // review list at REVIEW_LIMIT for display, and replaying only what was
  // displayed would silently drop the rest of the user's work.
  const entries = await db.operationJournal.where('projectId').equals(plan.projectId).sortBy('id');
  const replayable = entries.filter(
    (entry) => entry.projectId === plan.projectId && entry.baseRevision === plan.canonicalRevision,
  );

  let appliedCount = 0;
  let revision = plan.canonicalRevision;
  for (const record of replayable) {
    const result = await apply(record);
    if (result.status === 'rejected') {
      return {
        status: 'failed',
        appliedCount,
        failedOperationId: record.operationId,
        detail: result.reason,
      };
    }
    appliedCount += 1;
    revision = result.revision;
  }
  return { status: 'recovered', appliedCount, revision };
}

export interface RecoveryValidation {
  readonly ok: boolean;
  readonly reasons: readonly string[];
}

/**
 * The gate between a finished replay and an active workspace (V3-062).
 *
 * A replay that committed every operation still has to agree with the tier it
 * committed into before anything is shown as open: the revision the applier
 * reported must match what the working copy now says, and the journal must no
 * longer claim work the working copy lacks. Activating without this check would
 * make "recovered" mean "the replay did not throw", which is not the same as
 * the project being whole.
 */
export function validateRecoveredState(
  outcome: RecoveryApplyOutcome,
  observedCanonicalRevision: number,
  remainingPlan: RecoveryPlan,
): RecoveryValidation {
  const reasons: string[] = [];
  if (outcome.status !== 'recovered') {
    reasons.push(`replay did not complete (${outcome.status})`);
    return { ok: false, reasons };
  }
  if (outcome.revision !== observedCanonicalRevision) {
    reasons.push(
      `replay reported revision ${outcome.revision} but the working copy is on ${observedCanonicalRevision}`,
    );
  }
  if (hasRecoverableWork(remainingPlan)) {
    reasons.push(
      `${remainingPlan.replayableCount} journalled operation(s) still are not in the working copy`,
    );
  }
  if (remainingPlan.disposition === 'divergent') {
    reasons.push('the journal diverged from the working copy during replay');
  }
  return { ok: reasons.length === 0, reasons };
}

function emptyPlan(
  disposition: RecoveryDisposition,
  projectId: string,
  canonicalRevision: number,
): RecoveryPlan {
  return {
    disposition,
    projectId,
    canonicalRevision,
    replayableCount: 0,
    supersededCount: 0,
    highestJournalledBaseRevision: null,
    operations: [],
    affectedElementIds: [],
    truncated: false,
    autoApply: false,
  };
}

function summarise(
  entries: readonly LocalOperationJournalRecord[],
): readonly RecoveryOperationSummary[] {
  return entries.slice(0, REVIEW_LIMIT).map((entry) => ({
    operationId: entry.operationId,
    operationType: entry.operationType,
    baseRevision: entry.baseRevision,
    actorId: entry.actorId,
    createdAt: entry.createdAt,
    affectedElementIds: entry.affectedElementIds,
  }));
}

/**
 * Bounded by construction (V3-058). A journal can grow without limit, and a
 * recovery prompt that tries to name every touched element on a large project
 * is both unreadable and unbounded memory.
 */
function collectAffectedElementIds(
  entries: readonly LocalOperationJournalRecord[],
): readonly string[] {
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const id of entry.affectedElementIds) {
      if (seen.size >= AFFECTED_ELEMENT_LIMIT) {
        return [...seen];
      }
      seen.add(id);
    }
  }
  return [...seen];
}

/**
 * ARQ-147: implement safe mode.
 *
 * Blueprint section 72 ("Recovery")'s recovery screen offers a
 * "safe-mode option" alongside "duplicate-before-open" (a separate,
 * later feature - not this issue's scope). Section 123's "Reliability
 * rules" lists "safe mode" as its own principle. This module is the
 * decision behind that option: given a project's RecoveryReport
 * (recovery-report.ts, ARQ-075), what does opening "safely" actually
 * mean?
 *
 * Safe mode's answer: open strictly at the last snapshot's revision -
 * `RecoveryReport.snapshotRevision` - deferring *every* recovered
 * journal entry, not just the incomplete ones, rather than replaying
 * any of them. Normal (non-safe) recovery would replay every valid
 * recovered entry to reconstruct the most up-to-date state; safe mode
 * deliberately does not, because replaying is itself one of the things
 * that might have caused the original crash, and re-attempting it
 * immediately on every open would make safe mode no safer than a
 * normal one. This upholds "no committed work is discarded silently"
 * (this issue's own acceptance criterion, matching ARQ-146's): nothing
 * is deleted here - `deferredOperationCount` reports how many journal
 * entries are being held back, and they remain in the journal,
 * available to whatever later "exit safe mode and replay" action a
 * caller builds, not discarded.
 *
 * Deliberately just a decision, not an executor: this module does not
 * itself read a snapshot's bytes or replay any operation - it only
 * computes *what* a safe open should do, leaving the actual snapshot
 * load (already snapshot.ts's job) and operation replay (an
 * operations-layer concern this package does not own) to their
 * existing owners.
 */

import type { RecoveryReport } from './recovery-report';

export interface SafeModeOpenPlan {
  readonly projectId: string;
  /** The revision to open at - always the snapshot's own revision; no recovered journal entry is replayed. */
  readonly openAtRevision: number;
  /** How many recovered journal entries are being held back, unreplayed but not discarded. */
  readonly deferredOperationCount: number;
  readonly hasIncompleteOperations: boolean;
}

/** Computes a project's safe-mode open plan from its RecoveryReport - see this module's doc comment for why safe mode always defers every recovered entry, not just the incomplete ones. */
export function resolveSafeModeOpenPlan(report: RecoveryReport): SafeModeOpenPlan {
  return {
    projectId: report.projectId,
    openAtRevision: report.snapshotRevision,
    deferredOperationCount: report.recoveredOperationCount,
    hasIncompleteOperations: report.incompleteOperations.length > 0,
  };
}

/** Whether safe mode actually differs from a normal open for this project - false when there is nothing recovered to defer at all (an already-clean project). */
export function safeModeHasDeferredWork(plan: SafeModeOpenPlan): boolean {
  return plan.deferredOperationCount > 0;
}

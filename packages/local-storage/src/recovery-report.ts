/**
 * ARQ-075: implement abnormal-exit recovery.
 *
 * Assembles the data blueprint section 72's "Recovery" screen needs
 * ("project; last committed time; recovered operation count; any
 * incomplete operation; safe-mode option; duplicate-before-open option;
 * technical report export") from the latest snapshot (ARQ-073) and the
 * journal entries after it (ARQ-072). This module only computes that
 * report as data - presenting the recovery screen itself, and the
 * safe-mode/duplicate-before-open *actions*, are UI-layer concerns with
 * no pure-logic content of their own to build here yet.
 *
 * "Any incomplete operation" is detected structurally: a journal entry
 * missing required fields (an empty operationType, or a payload that
 * failed to serialize) rather than something this module can detect by
 * re-validating full operation semantics, which would require the
 * document/scene model this repository doesn't have yet (the same gap
 * noted at ARQ-034/041/042/065).
 */

import type { ArqLocalDatabase, LocalOperationJournalRecord } from './database';
import { readLatestSnapshot } from './snapshot';

export interface RecoveryReport {
  readonly projectId: string;
  readonly hasSnapshot: boolean;
  readonly lastCommittedAt: string | undefined;
  readonly recoveredOperationCount: number;
  readonly incompleteOperations: readonly LocalOperationJournalRecord[];
}

function isIncomplete(entry: LocalOperationJournalRecord): boolean {
  return entry.operationType.trim() === '' || entry.payload === undefined;
}

/**
 * "Recovered" journal entries are those not yet reflected in the latest
 * snapshot: an entry's baseRevision is the project revision it was
 * applied on top of, so an entry is only captured by a snapshot taken
 * *at or after* baseRevision + 1 - i.e. baseRevision < snapshot.revision.
 * This mirrors journal-recovery.ts's pruneJournalBeforeRevision, which
 * uses the identical comparison to decide what's safe to discard; it is
 * NOT the snapshot table's own row id, which is an unrelated
 * auto-increment sequence in a different table and cannot be compared
 * against the journal's baseRevision or its own row id.
 */
export async function computeRecoveryReport(
  db: ArqLocalDatabase,
  projectId: string,
): Promise<RecoveryReport> {
  const latestSnapshot = await readLatestSnapshot(db, projectId);
  const asOfRevision = latestSnapshot?.revision ?? 0;
  const allEntries = await db.operationJournal.where('projectId').equals(projectId).sortBy('id');
  const recovered = allEntries.filter((entry) => entry.baseRevision >= asOfRevision);
  const lastCommittedAt =
    recovered.length > 0 ? recovered[recovered.length - 1]?.createdAt : latestSnapshot?.createdAt;
  return {
    projectId,
    hasSnapshot: latestSnapshot !== undefined,
    lastCommittedAt,
    recoveredOperationCount: recovered.length,
    incompleteOperations: recovered.filter(isIncomplete),
  };
}

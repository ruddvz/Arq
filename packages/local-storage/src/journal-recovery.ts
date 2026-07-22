/**
 * ARQ-072: implement local journal.
 *
 * ARQ-071 added the operationJournal table and appendOperationRecord.
 * This adds the rest of blueprint section 71's "Journal and snapshots"
 * write-order/policy and section 72's "Recovery" reading side:
 *
 * - readJournalSince: replay/recovery reads entries after a given
 *   sequence (e.g. the sequence recorded in the last snapshot), giving
 *   "recovered operation count" and the entries needed to reconstruct
 *   state on top of that snapshot.
 * - shouldTakeSnapshot: a pure decision over section 71's *measurable*
 *   snapshot triggers (operation count threshold, elapsed time). Its
 *   other listed triggers - before migration, before major import,
 *   before an AI proposal, a user-named revision - are each a specific
 *   caller-initiated event, not something a passive threshold check can
 *   decide; they are the caller's responsibility to invoke directly,
 *   not something this function guesses at.
 * - pruneJournalBeforeRevision: once a snapshot has captured state as of
 *   a revision, journal entries with an *older* baseRevision are fully
 *   superseded and can be discarded to bound journal growth.
 */

import type { ArqLocalDatabase, LocalOperationJournalRecord } from './database';

export async function readJournalSince(
  db: ArqLocalDatabase,
  projectId: string,
  sinceSequence: number,
): Promise<readonly LocalOperationJournalRecord[]> {
  const all = await db.operationJournal.where('projectId').equals(projectId).sortBy('id');
  return all.filter((entry) => (entry.id ?? 0) > sinceSequence);
}

export interface SnapshotPolicyInput {
  readonly operationsSinceLastSnapshot: number;
  readonly msSinceLastSnapshot: number;
  readonly operationCountThreshold: number;
  readonly elapsedMsThreshold: number;
}

/** True if either the operation-count or elapsed-time threshold has been reached. */
export function shouldTakeSnapshot(input: SnapshotPolicyInput): boolean {
  return (
    input.operationsSinceLastSnapshot >= input.operationCountThreshold ||
    input.msSinceLastSnapshot >= input.elapsedMsThreshold
  );
}

/** Deletes journal entries for `projectId` whose baseRevision predates `revision` - safe once a snapshot as of `revision` exists. Returns the number of entries removed. */
export async function pruneJournalBeforeRevision(
  db: ArqLocalDatabase,
  projectId: string,
  revision: number,
): Promise<number> {
  const stale = await db.operationJournal
    .where('projectId')
    .equals(projectId)
    .filter((entry) => entry.baseRevision < revision)
    .toArray();
  const ids = stale.map((entry) => entry.id).filter((id): id is number => id !== undefined);
  await db.operationJournal.bulkDelete(ids);
  return ids.length;
}

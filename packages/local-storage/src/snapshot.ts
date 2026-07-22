/**
 * ARQ-073: implement snapshots.
 *
 * The other half of blueprint section 71's write order ("write journal;
 * publish committed state; schedule snapshot and sync"): taking a
 * snapshot and restoring the latest one, on the projectSnapshots table
 * ARQ-071 added. Uses the same appended/quota-exceeded/failed result
 * shape as journal-append.ts's appendOperationRecord, since a snapshot
 * write can fail for the same reasons a journal write can.
 */

import type { ArqLocalDatabase, LocalProjectSnapshotRecord } from './database';
import { isQuotaExceededError } from './quota-error';

export type WriteSnapshotResult =
  | { readonly status: 'written'; readonly id: number }
  | { readonly status: 'quota-exceeded'; readonly error: unknown }
  | { readonly status: 'failed'; readonly error: unknown };

export async function writeSnapshot(
  db: ArqLocalDatabase,
  record: Omit<LocalProjectSnapshotRecord, 'id'>,
): Promise<WriteSnapshotResult> {
  try {
    const id = await db.projectSnapshots.add(record as LocalProjectSnapshotRecord);
    return { status: 'written', id };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      return { status: 'quota-exceeded', error };
    }
    return { status: 'failed', error };
  }
}

/** Returns the highest-revision snapshot for the project, or undefined if none exists. */
export async function readLatestSnapshot(
  db: ArqLocalDatabase,
  projectId: string,
): Promise<LocalProjectSnapshotRecord | undefined> {
  const rows = await db.projectSnapshots.where('projectId').equals(projectId).sortBy('revision');
  return rows.at(-1);
}

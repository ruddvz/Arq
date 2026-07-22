/**
 * ARQ-074: implement quota handling.
 *
 * A shared classifier for "was this failure a storage quota problem" -
 * factored out of journal-append.ts (ARQ-071) and snapshot.ts (ARQ-073),
 * which each wrap a different Dexie write in their own
 * appended/written vs quota-exceeded vs failed result shape but need the
 * identical classification underneath. One place to get the DOMException
 * name check right, rather than two copies drifting apart.
 *
 * retryAfterPruning is the actual "handling" half, not just detection:
 * when a write hits quota-exceeded, the one thing this package can do
 * about it without user intervention is free space by discarding
 * journal entries already superseded by a snapshot (journal-recovery.ts,
 * ARQ-072), then retry the write once. If it still fails after pruning,
 * the caller is left with a definitive quota failure and no local
 * mitigation left to try - that is a UI-level concern (prompt the user,
 * offer the local-archive export from ARQ-071/073 before anything is
 * lost), not something this package can resolve further on its own.
 */

import type { ArqLocalDatabase } from './database';
import { pruneJournalBeforeRevision } from './journal-recovery';

export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError';
  }
  if (error && typeof error === 'object' && 'name' in error) {
    return (error as { name?: unknown }).name === 'QuotaExceededError';
  }
  return false;
}

export interface RetryAfterPruningResult<TResult> {
  readonly prunedCount: number;
  readonly result: TResult;
}

/** Prunes journal entries predating `safeToPruneBeforeRevision`, then runs `retryWrite` once. */
export async function retryAfterPruning<TResult>(
  db: ArqLocalDatabase,
  projectId: string,
  safeToPruneBeforeRevision: number,
  retryWrite: () => Promise<TResult>,
): Promise<RetryAfterPruningResult<TResult>> {
  const prunedCount = await pruneJournalBeforeRevision(db, projectId, safeToPruneBeforeRevision);
  const result = await retryWrite();
  return { prunedCount, result };
}

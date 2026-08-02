/**
 * ARQ-071 (continued): "Abnormal closure and quota failure are tested."
 *
 * appendOperationRecord wraps a raw Dexie table write so callers get a
 * typed result distinguishing four outcomes instead of an uncaught
 * exception: a normal success, a duplicate that was already recorded, a
 * quota-exceeded failure (the browser refused to allocate more storage), or
 * any other failure (including writing to a database that has already
 * abnormally closed - Dexie throws its own DatabaseClosedError for that
 * case, which falls into 'failed' here since there is nothing
 * quota-specific about it).
 *
 * The append is idempotent per (projectId, operationId), which it previously
 * was not: a bare `add` meant a retried append after an ambiguous failure
 * wrote a second row. Because the journal is replayed in `++id` order, that
 * second row lands at the END of the log rather than at its original
 * position, so a sequence like create-then-delete replays as
 * create-delete-create and reconstructs a document the user never had. An
 * append-only log is only safe to replay if appending the same thing twice
 * is the same as appending it once.
 */

import type { ArqLocalDatabase, LocalOperationJournalRecord } from './database';
import { isQuotaExceededError } from './quota-error';

export type AppendOperationResult =
  | { readonly status: 'appended'; readonly sequence: number }
  /** This operation id was already recorded for this project; nothing was written. */
  | { readonly status: 'duplicate'; readonly sequence: number }
  | { readonly status: 'quota-exceeded'; readonly error: unknown }
  | { readonly status: 'failed'; readonly error: unknown };

export async function appendOperationRecord(
  db: ArqLocalDatabase,
  record: Omit<LocalOperationJournalRecord, 'id'>,
): Promise<AppendOperationResult> {
  try {
    // Read and write in one transaction: without it, two concurrent appends of
    // the same operation could both observe "not present" and both write.
    return await db.transaction('rw', db.operationJournal, async () => {
      const existing = await db.operationJournal
        .where('[projectId+operationId]')
        .equals([record.projectId, record.operationId])
        .first();
      if (existing?.id !== undefined) {
        return { status: 'duplicate', sequence: existing.id };
      }
      const sequence = await db.operationJournal.add(record as LocalOperationJournalRecord);
      return { status: 'appended', sequence };
    });
  } catch (error) {
    if (isQuotaExceededError(error)) {
      return { status: 'quota-exceeded', error };
    }
    return { status: 'failed', error };
  }
}

/**
 * Registers a listener for Dexie's 'close' event - fired on an abnormal
 * closure (e.g. the browser evicted the database under storage
 * pressure, or another tab deleted it), distinct from a caller-initiated
 * `db.close()`. Returns an unsubscribe function.
 */
export function onAbnormalClose(db: ArqLocalDatabase, onClose: () => void): () => void {
  db.on('close', onClose);
  return () => {
    db.on('close').unsubscribe(onClose);
  };
}

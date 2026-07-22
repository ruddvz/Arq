/**
 * ARQ-071 (continued): "Abnormal closure and quota failure are tested."
 *
 * appendOperationRecord wraps a raw Dexie table write so callers get a
 * typed result distinguishing three outcomes instead of an uncaught
 * exception: a normal success, a quota-exceeded failure (the browser
 * refused to allocate more storage), or any other failure (including
 * writing to a database that has already abnormally closed - Dexie
 * throws its own DatabaseClosedError for that case, which falls into
 * 'failed' here since there is nothing quota-specific about it).
 */

import type { ArqLocalDatabase, LocalOperationJournalRecord } from './database';

export type AppendOperationResult =
  | { readonly status: 'appended'; readonly sequence: number }
  | { readonly status: 'quota-exceeded'; readonly error: unknown }
  | { readonly status: 'failed'; readonly error: unknown };

function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError';
  }
  if (error && typeof error === 'object' && 'name' in error) {
    return (error as { name?: unknown }).name === 'QuotaExceededError';
  }
  return false;
}

export async function appendOperationRecord(
  db: ArqLocalDatabase,
  record: Omit<LocalOperationJournalRecord, 'id'>,
): Promise<AppendOperationResult> {
  try {
    const sequence = await db.operationJournal.add(record as LocalOperationJournalRecord);
    return { status: 'appended', sequence };
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

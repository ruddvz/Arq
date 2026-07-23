/**
 * ARQ-146: implement corrupt cache recovery.
 *
 * Blueprint section 72 ("Recovery")'s closing line: "Derived caches may
 * be discarded and regenerated." This module is that recovery path for
 * the one kind of local data this repository has that is genuinely
 * regeneratable rather than authoritative - a `derivedCaches` table
 * (database.ts, `LocalDerivedCacheRecord`), kept in its own Dexie
 * table, separate from `projectSnapshots`/`operationJournal`, so this
 * module structurally cannot touch committed project data: it only
 * ever reads from and deletes rows in `derivedCaches`, upholding this
 * issue's own acceptance criterion "no committed work is discarded
 * silently" by construction rather than by convention.
 *
 * Corruption is detected the same way `.arq` archive integrity already
 * is (`@arq/project-format`'s `computeChecksums`/`verifyChecksums`,
 * ARQ-077, section 73's "checksums" requirement): each cache entry
 * stores a SHA-256 of its own data at write time; recovery recomputes
 * that hash and discards any entry whose data no longer matches it -
 * reusing the existing, already-tested checksum primitive rather than
 * inventing a second one.
 */

import { computeChecksums, verifyChecksums } from '@arq/project-format';
import type { ArqLocalDatabase, LocalDerivedCacheRecord } from './database';

/** Writes (or replaces) a derived cache entry for `projectId`/`cacheKey`, recording a checksum of `data` for later corruption detection. */
export async function writeDerivedCache(
  db: ArqLocalDatabase,
  projectId: string,
  cacheKey: string,
  data: Uint8Array,
): Promise<void> {
  const [checksum] = await computeChecksums(new Map([[cacheKey, data]]));
  if (checksum === undefined) {
    throw new Error('computeChecksums did not return an entry for the given cacheKey');
  }
  const existing = await db.derivedCaches
    .where('[projectId+cacheKey]')
    .equals([projectId, cacheKey])
    .first();
  const record: LocalDerivedCacheRecord = { projectId, cacheKey, data, sha256: checksum.sha256 };
  if (existing?.id !== undefined) {
    await db.derivedCaches.put({ ...record, id: existing.id });
  } else {
    await db.derivedCaches.add(record);
  }
}

export interface CorruptCacheRecoveryReport {
  readonly checkedCacheKeys: readonly string[];
  readonly discardedCacheKeys: readonly string[];
}

/**
 * Verifies every derived cache entry for `projectId` against its
 * recorded checksum and deletes any whose data no longer matches -
 * only ever reading/writing the `derivedCaches` table, never
 * `projectSnapshots` or `operationJournal`.
 */
export async function recoverCorruptDerivedCaches(
  db: ArqLocalDatabase,
  projectId: string,
): Promise<CorruptCacheRecoveryReport> {
  const entries = await db.derivedCaches.where('projectId').equals(projectId).toArray();
  const checkedCacheKeys = entries.map((entry) => entry.cacheKey);
  const discardedCacheKeys: string[] = [];

  for (const entry of entries) {
    const mismatches = await verifyChecksums(new Map([[entry.cacheKey, entry.data]]), [
      { path: entry.cacheKey, sha256: entry.sha256 },
    ]);
    if (mismatches.length > 0 && entry.id !== undefined) {
      await db.derivedCaches.delete(entry.id);
      discardedCacheKeys.push(entry.cacheKey);
    }
  }

  return { checkedCacheKeys, discardedCacheKeys };
}

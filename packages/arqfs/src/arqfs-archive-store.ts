import type { ArqfsDriver } from './arqfs-driver';
import {
  DEFAULT_ARQFS_STORAGE_POLICY,
  validateArqfsArchivePath,
  validateArchiveEntryBytes,
  validateArchiveEntryLength,
  validateArchiveTotals,
  type ArqfsStoragePolicy,
} from './arqfs-policy';

/**
 * Stores/reads @arq/project-format's existing logical archive entries (manifest.json,
 * model.json, operations.ndjson, views.json, sheets.json, checksums.json) as
 * `archive_entry` rows - see docs/architecture/ARQ-FILE-FORMAT.md's "Relationship to
 * the existing @arq/project-format archive". This module does not know or care what
 * an entry's bytes mean; @arq/project-format's own exportArchive/importArchive still
 * own parsing, checksums and migration.
 */
export function putArchiveEntry(
  driver: ArqfsDriver,
  path: string,
  content: Uint8Array,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): void {
  validateArchiveEntryBytes(path, content, policy);
  const existing = driver.query<{ readonly byte_length: number }>(
    'SELECT LENGTH(content) AS byte_length FROM archive_entry WHERE path = ?',
    [path],
  )[0];
  const totals = driver.query<{
    readonly entry_count: number;
    readonly total_bytes: number | null;
  }>(
    'SELECT COUNT(*) AS entry_count, COALESCE(SUM(LENGTH(content)), 0) AS total_bytes FROM archive_entry',
  )[0];
  const entryCount = Number(totals?.entry_count ?? 0) + (existing === undefined ? 1 : 0);
  const totalBytes =
    Number(totals?.total_bytes ?? 0) - Number(existing?.byte_length ?? 0) + content.byteLength;
  validateArchiveTotals(entryCount, totalBytes, policy);
  driver.run(
    `INSERT INTO archive_entry (path, content, updated_at_unix_ms) VALUES (?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET content = excluded.content, updated_at_unix_ms = excluded.updated_at_unix_ms`,
    [path, content, Date.now()],
  );
}

export function putArchiveEntries(
  driver: ArqfsDriver,
  entries: ReadonlyMap<string, Uint8Array>,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): void {
  driver.transaction(() => {
    const existingRows = driver.query<{
      readonly path: string;
      readonly byte_length: number;
    }>('SELECT path, LENGTH(content) AS byte_length FROM archive_entry');
    for (const row of existingRows) {
      validateArqfsArchivePath(row.path, policy);
      validateArchiveEntryLength(Number(row.byte_length), policy);
    }
    const existingBytes = new Map(existingRows.map((row) => [row.path, Number(row.byte_length)]));
    let entryCount = existingRows.length;
    let totalBytes = existingRows.reduce((sum, row) => sum + Number(row.byte_length), 0);
    for (const [path, content] of entries) {
      validateArchiveEntryBytes(path, content, policy);
      const previousBytes = existingBytes.get(path);
      if (previousBytes === undefined) entryCount += 1;
      totalBytes += content.byteLength - (previousBytes ?? 0);
      validateArchiveTotals(entryCount, totalBytes, policy);
      driver.run(
        `INSERT INTO archive_entry (path, content, updated_at_unix_ms) VALUES (?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET content = excluded.content, updated_at_unix_ms = excluded.updated_at_unix_ms`,
        [path, content, Date.now()],
      );
      existingBytes.set(path, content.byteLength);
    }
  });
}

/** Removes one logical entry. Missing entries are a successful no-op. */
export function removeArchiveEntry(driver: ArqfsDriver, path: string): void {
  validateArchiveEntryBytes(path, new Uint8Array(0));
  driver.run('DELETE FROM archive_entry WHERE path = ?', [path]);
}

export function getArchiveEntry(driver: ArqfsDriver, path: string): Uint8Array | null {
  validateArchiveEntryBytes(path, new Uint8Array(0));
  const rows = driver.query<{ readonly content: Uint8Array }>(
    'SELECT content FROM archive_entry WHERE path = ?',
    [path],
  );
  const row = rows[0];
  return row ? new Uint8Array(row.content) : null;
}

export function listArchiveEntryPaths(driver: ArqfsDriver): readonly string[] {
  return driver
    .query<{ readonly path: string }>('SELECT path FROM archive_entry ORDER BY path')
    .map((row) => {
      validateArchiveEntryBytes(row.path, new Uint8Array(0));
      return row.path;
    });
}

/** Reads every stored entry back into the same Map<path, bytes> shape exportArchive/importArchive already use. */
export function readAllArchiveEntries(driver: ArqfsDriver): Map<string, Uint8Array> {
  const rows = driver.query<{ readonly path: string; readonly content: Uint8Array }>(
    'SELECT path, content FROM archive_entry ORDER BY path',
  );
  return new Map(
    rows.map((row) => {
      const content = new Uint8Array(row.content);
      validateArchiveEntryBytes(row.path, content);
      return [row.path, content];
    }),
  );
}

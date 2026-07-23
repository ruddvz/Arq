import type { ArqfsDriver } from './arqfs-driver';

/**
 * Stores/reads @arq/project-format's existing logical archive entries (manifest.json,
 * model.json, operations.ndjson, views.json, sheets.json, checksums.json) as
 * `archive_entry` rows - see docs/architecture/ARQ-FILE-FORMAT.md's "Relationship to
 * the existing @arq/project-format archive". This module does not know or care what
 * an entry's bytes mean; @arq/project-format's own exportArchive/importArchive still
 * own parsing, checksums and migration.
 */
export function putArchiveEntry(driver: ArqfsDriver, path: string, content: Uint8Array): void {
  driver.run(
    `INSERT INTO archive_entry (path, content, updated_at_unix_ms) VALUES (?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET content = excluded.content, updated_at_unix_ms = excluded.updated_at_unix_ms`,
    [path, content, Date.now()],
  );
}

export function putArchiveEntries(
  driver: ArqfsDriver,
  entries: ReadonlyMap<string, Uint8Array>,
): void {
  driver.transaction(() => {
    for (const [path, content] of entries) {
      putArchiveEntry(driver, path, content);
    }
  });
}

export function getArchiveEntry(driver: ArqfsDriver, path: string): Uint8Array | null {
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
    .map((row) => row.path);
}

/** Reads every stored entry back into the same Map<path, bytes> shape exportArchive/importArchive already use. */
export function readAllArchiveEntries(driver: ArqfsDriver): Map<string, Uint8Array> {
  const rows = driver.query<{ readonly path: string; readonly content: Uint8Array }>(
    'SELECT path, content FROM archive_entry',
  );
  return new Map(rows.map((row) => [row.path, new Uint8Array(row.content)]));
}

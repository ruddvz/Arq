import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putArchiveEntry, getArchiveEntry } from './arqfs-archive-store';
import { migrateArqfsSchemaV1ToV2, migrateArqfsSchemaV1ToV2ViaCopy } from './arqfs-schema-v2';
import type { ArqfsDriver } from './arqfs-driver';

function sha256OfFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

describe('schema v2 migration', () => {
  it('adds provenance/import tables without replacing v1 content', () => {
    const driver = createNodeArqfsDriver(':memory:');
    try {
      createArqfsSchemaV1(driver);
      const result = migrateArqfsSchemaV1ToV2(driver, 1);
      expect(result).toEqual({ status: 'migrated', from: 1, to: 2 });
      expect(driver.pragma('user_version')).toBe(2);
      const tables = driver
        .query<{ readonly name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .map((row) => row.name);
      expect(tables).toContain('source_document');
      expect(tables).toContain('import_session');
      expect(tables).toContain('archive_entry');
    } finally {
      driver.close();
    }
  });

  describe('migrateArqfsSchemaV1ToV2ViaCopy (FP-004)', () => {
    let dir: string;
    let sourceDriver: ArqfsDriver;

    beforeEach(() => {
      dir = mkdtempSync(path.join(tmpdir(), 'arqfs-schema-v2-copy-'));
    });

    afterEach(() => {
      sourceDriver?.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('migrates a real v1 file to v2 on a fresh copy, leaving the source file bytes completely unchanged', () => {
      const sourcePath = path.join(dir, 'source.sqlite3');
      sourceDriver = createNodeArqfsDriver(sourcePath);
      createArqfsSchemaV1(sourceDriver);
      putArchiveEntry(sourceDriver, 'model.json', new TextEncoder().encode('{"walls":[]}'));
      // Close and reopen so every page is flushed to disk before hashing - the
      // point of this test is the real file's bytes, not an in-memory view of it.
      sourceDriver.close();
      sourceDriver = createNodeArqfsDriver(sourcePath);

      const sourceShaBefore = sha256OfFile(sourcePath);
      const targetPath = path.join(dir, 'migrated.sqlite3');

      const result = migrateArqfsSchemaV1ToV2ViaCopy(
        sourceDriver,
        targetPath,
        createNodeArqfsDriver,
      );

      expect(result).toEqual({ status: 'migrated' });
      // The real, on-disk source file must be byte-for-byte unchanged - not just
      // "unchanged as observed through the still-open driver's own connection".
      expect(sha256OfFile(sourcePath)).toBe(sourceShaBefore);
      expect(getArchiveEntry(sourceDriver, 'model.json')).toEqual(
        new TextEncoder().encode('{"walls":[]}'),
      );

      const migratedDriver = createNodeArqfsDriver(targetPath);
      try {
        expect(migratedDriver.pragma('user_version')).toBe(2);
        expect(getArchiveEntry(migratedDriver, 'model.json')).toEqual(
          new TextEncoder().encode('{"walls":[]}'),
        );
      } finally {
        migratedDriver.close();
      }
    });

    it('rejects rather than throws, and leaves the source file untouched, when the copy is not schema v1', () => {
      const sourcePath = path.join(dir, 'source.sqlite3');
      sourceDriver = createNodeArqfsDriver(sourcePath);
      createArqfsSchemaV1(sourceDriver);
      migrateArqfsSchemaV1ToV2(sourceDriver);
      sourceDriver.close();
      sourceDriver = createNodeArqfsDriver(sourcePath);

      const sourceShaBefore = sha256OfFile(sourcePath);
      const targetPath = path.join(dir, 'migrated.sqlite3');

      const result = migrateArqfsSchemaV1ToV2ViaCopy(
        sourceDriver,
        targetPath,
        createNodeArqfsDriver,
      );

      expect(result.status).toBe('rejected');
      expect(sha256OfFile(sourcePath)).toBe(sourceShaBefore);
    });
  });
});

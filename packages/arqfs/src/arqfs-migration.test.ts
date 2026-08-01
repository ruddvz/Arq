import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putArchiveEntry, getArchiveEntry } from './arqfs-archive-store';
import { migrateArqfsCopyOnWrite } from './arqfs-migration';
import type { ArqfsDriver } from './arqfs-driver';

describe('migrateArqfsCopyOnWrite', () => {
  let dir: string;
  let sourceDriver: ArqfsDriver;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arqfs-migration-'));
  });

  afterEach(() => {
    sourceDriver?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function freshSource(): ArqfsDriver {
    const sourcePath = path.join(dir, 'source.sqlite3');
    sourceDriver = createNodeArqfsDriver(sourcePath);
    createArqfsSchemaV1(sourceDriver);
    return sourceDriver;
  }

  it('applies a migration to a fresh copy and leaves the source completely untouched', () => {
    const source = freshSource();
    putArchiveEntry(source, 'model.json', new TextEncoder().encode('{"walls":[]}'));
    const targetPath = path.join(dir, 'migrated.sqlite3');

    const result = migrateArqfsCopyOnWrite(source, targetPath, createNodeArqfsDriver, (target) => {
      target.exec('CREATE TABLE migration_marker (applied INTEGER NOT NULL)');
      target.run('INSERT INTO migration_marker (applied) VALUES (1)');
    });

    expect(result).toEqual({ status: 'migrated' });

    // Source must not have the migration's change.
    const sourceTables = source
      .query<{ readonly name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);
    expect(sourceTables).not.toContain('migration_marker');
    expect(getArchiveEntry(source, 'model.json')).toEqual(new TextEncoder().encode('{"walls":[]}'));

    // Target must have both the original data and the migration's change.
    const migratedDriver = createNodeArqfsDriver(targetPath);
    try {
      expect(getArchiveEntry(migratedDriver, 'model.json')).toEqual(
        new TextEncoder().encode('{"walls":[]}'),
      );
      expect(migratedDriver.query('SELECT applied FROM migration_marker')).toEqual([
        { applied: 1 },
      ]);
    } finally {
      migratedDriver.close();
    }
  });

  it('rejects without ever attempting the migration if the export itself fails (e.g. target already exists)', () => {
    const source = freshSource();
    const targetPath = path.join(dir, 'migrated.sqlite3');

    // A zero-byte file (e.g. from opening and closing a Database handle without ever
    // writing to it) does not count as "already exists" to SQLite's own VACUUM INTO -
    // it needs real content, matching a genuinely pre-existing database.
    const preExisting = createNodeArqfsDriver(targetPath);
    preExisting.exec('CREATE TABLE placeholder (id INTEGER)');
    preExisting.close();

    let migrationRan = false;
    const result = migrateArqfsCopyOnWrite(source, targetPath, createNodeArqfsDriver, () => {
      migrationRan = true;
    });

    expect(result).toEqual({ status: 'rejected', reason: 'target-exists' });
    expect(migrationRan).toBe(false);
  });

  it('rejects rather than throws when the migration transform itself fails, and the source is unaffected', () => {
    const source = freshSource();
    const targetPath = path.join(dir, 'migrated.sqlite3');

    const result = migrateArqfsCopyOnWrite(source, targetPath, createNodeArqfsDriver, (target) => {
      target.exec('THIS IS NOT VALID SQL');
    });

    expect(result.status).toBe('rejected');
    // The source driver must still be perfectly usable after a failed migration attempt.
    expect(() => source.query('SELECT 1')).not.toThrow();
  });

  /**
   * A rejection means this build just produced a corrupt copy of a real user
   * project while upgrading it. That copy is the whole evidence of the bug -
   * the source is untouched by design - and `removeTarget` deletes it at the
   * moment it becomes valuable. Quarantining keeps it and still clears the
   * target path, so the obvious retry does not fail with `target-exists`.
   */
  describe('preserving a failed migration', () => {
    it('quarantines the failed copy and reports where it went', () => {
      const source = freshSource();
      const targetPath = path.join(dir, 'migrated.sqlite3');
      const quarantinePath = path.join(dir, 'migrated.sqlite3.failed');

      const result = migrateArqfsCopyOnWrite(
        source,
        targetPath,
        createNodeArqfsDriver,
        (target) => {
          target.exec('THIS IS NOT VALID SQL');
        },
        {
          quarantineTarget: (target) => {
            renameSync(target, quarantinePath);
            return quarantinePath;
          },
        },
      );

      expect(result.status).toBe('rejected');
      if (result.status !== 'rejected') return;
      expect(result.quarantinedAt).toBe(quarantinePath);
      // The evidence survives, and the target path is free for a retry.
      expect(existsSync(quarantinePath)).toBe(true);
      expect(existsSync(targetPath)).toBe(false);
    });

    it('prefers quarantine over removal when a caller supplies both', () => {
      const source = freshSource();
      const targetPath = path.join(dir, 'migrated.sqlite3');
      const quarantinePath = path.join(dir, 'kept.sqlite3');
      let removed = false;

      const result = migrateArqfsCopyOnWrite(
        source,
        targetPath,
        createNodeArqfsDriver,
        (target) => {
          target.exec('THIS IS NOT VALID SQL');
        },
        {
          removeTarget: () => {
            removed = true;
          },
          quarantineTarget: (target) => {
            renameSync(target, quarantinePath);
            return quarantinePath;
          },
        },
      );

      expect(result.status).toBe('rejected');
      expect(removed).toBe(false);
      expect(existsSync(quarantinePath)).toBe(true);
    });

    it('reports the rejection without a quarantine path when preserving the copy fails', () => {
      const source = freshSource();
      const targetPath = path.join(dir, 'migrated.sqlite3');

      const result = migrateArqfsCopyOnWrite(
        source,
        targetPath,
        createNodeArqfsDriver,
        (target) => {
          target.exec('THIS IS NOT VALID SQL');
        },
        {
          quarantineTarget: () => {
            throw new Error('read-only volume');
          },
        },
      );

      // A failure to preserve must not become a thrown error, and must not
      // claim a copy was kept when none was.
      expect(result.status).toBe('rejected');
      if (result.status !== 'rejected') return;
      expect(result.quarantinedAt).toBeUndefined();
    });

    it('still removes the copy for callers that only supply removeTarget', () => {
      const source = freshSource();
      const targetPath = path.join(dir, 'migrated.sqlite3');

      const result = migrateArqfsCopyOnWrite(
        source,
        targetPath,
        createNodeArqfsDriver,
        (target) => {
          target.exec('THIS IS NOT VALID SQL');
        },
        { removeTarget: (target) => rmSync(target, { force: true }) },
      );

      expect(result.status).toBe('rejected');
      expect(existsSync(targetPath)).toBe(false);
    });

    it('does not quarantine or remove anything when the migration succeeds', () => {
      const source = freshSource();
      const targetPath = path.join(dir, 'migrated.sqlite3');
      let quarantined = false;

      const result = migrateArqfsCopyOnWrite(source, targetPath, createNodeArqfsDriver, () => {}, {
        quarantineTarget: (target) => {
          quarantined = true;
          return target;
        },
      });

      expect(result).toEqual({ status: 'migrated' });
      expect(quarantined).toBe(false);
      expect(existsSync(targetPath)).toBe(true);
    });
  });

  it('the source driver is never closed by this function', () => {
    const source = freshSource();
    const targetPath = path.join(dir, 'migrated.sqlite3');

    migrateArqfsCopyOnWrite(source, targetPath, createNodeArqfsDriver, () => {});

    expect(() => source.query('SELECT 1')).not.toThrow();
  });
});

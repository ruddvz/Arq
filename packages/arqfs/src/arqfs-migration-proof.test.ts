import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, rmSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { migrateArqfsSchemaV1ToV2ViaCopy } from './arqfs-schema-v2';
import { migrateArqfsCopyOnWrite } from './arqfs-migration';
import { putArchiveEntry, readAllArchiveEntries } from './arqfs-archive-store';
import { computeProjectSemanticHash } from './arqfs-semantic-hash';
import { exportCleanArqfsCopy } from './arqfs-clean-export';
import { openArqfs } from './arqfs-open';
import { checkArqfsIntegrity } from './arqfs-integrity';
import { preflightArqfsBytes } from './arqfs-preflight';
import type { ArqfsDriver } from './arqfs-driver';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * A golden fixture: a small but realistic project whose entries exercise nested
 * logical paths, binary content and a zero-length entry. Written through the same
 * public helpers a real save uses, so the fixture cannot drift from the code path
 * it is meant to protect.
 */
const GOLDEN_ENTRIES: readonly (readonly [string, Uint8Array])[] = [
  ['manifest.json', bytes('{"schema":"arq/1","project":"golden"}')],
  ['model/walls.json', bytes('{"walls":[{"id":"w1","length":3200}]}')],
  ['model/levels.json', bytes('{"levels":[{"id":"l0","elevation":0}]}')],
  ['sheets/a-101.json', bytes('{"sheet":"A-101","scale":50}')],
  ['thumbnails/preview.bin', new Uint8Array([0, 1, 2, 253, 254, 255])],
  ['empty.bin', new Uint8Array(0)],
];

function writeGoldenProject(driver: ArqfsDriver): void {
  createArqfsSchemaV1(driver);
  for (const [entryPath, content] of GOLDEN_ENTRIES) {
    putArchiveEntry(driver, entryPath, content);
  }
}

describe('schema v1 to v2 migration proof', () => {
  let dir: string;
  let source: ArqfsDriver;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arqfs-migration-proof-'));
  });

  afterEach(() => {
    try {
      source?.close();
    } catch {
      // Some tests close the source themselves.
    }
    rmSync(dir, { recursive: true, force: true });
  });

  function freshGoldenSource(): { readonly driver: ArqfsDriver; readonly filePath: string } {
    const filePath = path.join(dir, 'source.arq');
    source = createNodeArqfsDriver(filePath);
    writeGoldenProject(source);
    return { driver: source, filePath };
  }

  /**
   * The migration contract in one test: the source file's bytes are identical
   * afterwards, and the migrated copy carries exactly the same canonical semantic
   * hash. A migration that changed project meaning would move the hash even if the
   * source bytes were untouched, so both halves are needed.
   */
  it('preserves the source bytes and the canonical semantic hash', async () => {
    const { driver, filePath } = freshGoldenSource();
    const sourceHashBefore = await computeProjectSemanticHash(driver);
    driver.close();

    const sourceBytesBefore = readFileSync(filePath);
    const targetPath = path.join(dir, 'migrated.arq');

    const reopened = createNodeArqfsDriver(filePath);
    source = reopened;
    const result = migrateArqfsSchemaV1ToV2ViaCopy(reopened, targetPath, createNodeArqfsDriver);
    expect(result).toEqual({ status: 'migrated' });
    reopened.close();

    expect(readFileSync(filePath)).toEqual(sourceBytesBefore);

    const migrated = createNodeArqfsDriver(targetPath);
    source = migrated;
    expect(migrated.pragma('user_version')).toBe(2);
    expect(await computeProjectSemanticHash(migrated)).toBe(sourceHashBefore);
    expect(readAllArchiveEntries(migrated)).toEqual(new Map(GOLDEN_ENTRIES));
    expect(checkArqfsIntegrity(migrated).ok).toBe(true);
    expect(openArqfs(migrated).status).toBe('opened');
  });

  it('produces a migrated file that passes byte preflight as a real file on disk', () => {
    const { driver } = freshGoldenSource();
    const targetPath = path.join(dir, 'migrated.arq');

    expect(migrateArqfsSchemaV1ToV2ViaCopy(driver, targetPath, createNodeArqfsDriver)).toEqual({
      status: 'migrated',
    });

    const preflight = preflightArqfsBytes(new Uint8Array(readFileSync(targetPath)));
    expect(preflight.status).toBe('accepted');
  });

  /** A clean export must not depend on sidecars that a copy would leave behind. */
  it('the migrated file has no WAL or SHM sidecar', () => {
    const { driver } = freshGoldenSource();
    driver.exec('PRAGMA journal_mode = WAL');
    const targetPath = path.join(dir, 'migrated.arq');

    expect(migrateArqfsSchemaV1ToV2ViaCopy(driver, targetPath, createNodeArqfsDriver)).toEqual({
      status: 'migrated',
    });

    expect(existsSync(`${targetPath}-wal`)).toBe(false);
    expect(existsSync(`${targetPath}-shm`)).toBe(false);
  });

  // --- failure injection around the migration ----------------------------------

  /**
   * Failure during the transform. The source must remain the last committed
   * revision, and with a cleanup hook the abandoned target must not survive to
   * block the obvious retry.
   */
  it('removes the abandoned target and preserves the source when the transform fails', async () => {
    const { driver, filePath } = freshGoldenSource();
    const hashBefore = await computeProjectSemanticHash(driver);
    const sourceBytesBefore = readFileSync(filePath);
    const targetPath = path.join(dir, 'migrated.arq');

    const result = migrateArqfsCopyOnWrite(
      driver,
      targetPath,
      createNodeArqfsDriver,
      (target) => {
        target.exec('DROP TABLE archive_entry');
        throw new Error('transform failed after mutating the copy');
      },
      { removeTarget: (target) => rmSync(target, { force: true }) },
    );

    expect(result.status).toBe('rejected');
    expect(existsSync(targetPath)).toBe(false);
    expect(readFileSync(filePath)).toEqual(sourceBytesBefore);
    expect(await computeProjectSemanticHash(driver)).toBe(hashBefore);
  });

  /**
   * Failure during validation rather than during the transform: the transform
   * "succeeds" but leaves a file that cannot open as an arqfs project.
   */
  it('rejects and cleans up when the migrated copy no longer opens cleanly', () => {
    const { driver } = freshGoldenSource();
    const targetPath = path.join(dir, 'migrated.arq');

    const result = migrateArqfsCopyOnWrite(
      driver,
      targetPath,
      createNodeArqfsDriver,
      (target) => {
        // Structurally destroys the file's arqfs identity without throwing.
        target.exec('DROP TABLE arqfs_meta');
      },
      { removeTarget: (target) => rmSync(target, { force: true }) },
    );

    expect(result).toMatchObject({ status: 'rejected' });
    expect(existsSync(targetPath)).toBe(false);
    expect(openArqfs(driver).status).toBe('opened');
  });

  it('leaves the abandoned target in place when no cleanup hook is supplied', () => {
    const { driver } = freshGoldenSource();
    const targetPath = path.join(dir, 'migrated.arq');

    const result = migrateArqfsCopyOnWrite(driver, targetPath, createNodeArqfsDriver, () => {
      throw new Error('transform failed');
    });

    expect(result.status).toBe('rejected');
    // Documented behaviour, not an accident: without a hook this module cannot
    // reach the filesystem, so the caller owns the debris.
    expect(existsSync(targetPath)).toBe(true);
  });

  it('a cleanup hook that itself fails does not turn a rejection into a throw', () => {
    const { driver } = freshGoldenSource();
    const targetPath = path.join(dir, 'migrated.arq');

    expect(() =>
      migrateArqfsCopyOnWrite(
        driver,
        targetPath,
        createNodeArqfsDriver,
        () => {
          throw new Error('transform failed');
        },
        {
          removeTarget: () => {
            throw new Error('cleanup also failed');
          },
        },
      ),
    ).not.toThrow();
  });

  it('never removes a pre-existing target it did not create', () => {
    const { driver } = freshGoldenSource();
    const targetPath = path.join(dir, 'migrated.arq');
    const preExisting = createNodeArqfsDriver(targetPath);
    preExisting.exec('CREATE TABLE placeholder (id INTEGER)');
    preExisting.close();
    const preExistingBytes = readFileSync(targetPath);

    const result = migrateArqfsCopyOnWrite(
      driver,
      targetPath,
      createNodeArqfsDriver,
      () => undefined,
      { removeTarget: (target) => rmSync(target, { force: true }) },
    );

    expect(result).toEqual({ status: 'rejected', reason: 'target-exists' });
    expect(readFileSync(targetPath)).toEqual(preExistingBytes);
  });
});

describe('clean export boundaries', () => {
  let dir: string;
  let driver: ArqfsDriver;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arqfs-export-boundary-'));
  });

  afterEach(() => {
    driver?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Exporting onto the source's own path would destroy the only copy. */
  it('refuses to export a project over its own file', () => {
    const filePath = path.join(dir, 'source.arq');
    driver = createNodeArqfsDriver(filePath);
    writeGoldenProject(driver);
    const sizeBefore = statSync(filePath).size;

    expect(exportCleanArqfsCopy(driver, filePath)).toEqual({
      status: 'rejected',
      reason: 'target-exists',
    });
    expect(statSync(filePath).size).toBe(sizeBefore);
    expect(openArqfs(driver).status).toBe('opened');
  });

  it('exports a byte-identical-meaning copy that carries the same semantic hash', async () => {
    const filePath = path.join(dir, 'source.arq');
    const exportPath = path.join(dir, 'export.arq');
    driver = createNodeArqfsDriver(filePath);
    writeGoldenProject(driver);
    const hashBefore = await computeProjectSemanticHash(driver);

    expect(exportCleanArqfsCopy(driver, exportPath)).toEqual({ status: 'exported' });

    const exported = createNodeArqfsDriver(exportPath);
    try {
      expect(await computeProjectSemanticHash(exported)).toBe(hashBefore);
      expect(checkArqfsIntegrity(exported).ok).toBe(true);
    } finally {
      exported.close();
    }
  });
});

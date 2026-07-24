import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putArchiveEntry, getArchiveEntry } from './arqfs-archive-store';
import { commitArqfsFileSwap, validateArqfsFileForSwap } from './arqfs-node-atomic-swap';
import type { ArqfsDriver } from './arqfs-driver';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('commitArqfsFileSwap', () => {
  let dir: string;
  const openDrivers: ArqfsDriver[] = [];

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arqfs-swap-'));
  });

  afterEach(() => {
    while (openDrivers.length > 0) openDrivers.pop()?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Writes a real arqfs file containing one marker entry, then closes it. */
  function writeProject(filePath: string, marker: string): void {
    const driver = createNodeArqfsDriver(filePath);
    createArqfsSchemaV1(driver);
    putArchiveEntry(driver, 'manifest.json', bytes(marker));
    driver.close();
  }

  function readMarker(filePath: string): string | null {
    const driver = createNodeArqfsDriver(filePath);
    openDrivers.push(driver);
    const content = getArchiveEntry(driver, 'manifest.json');
    const value = content === null ? null : new TextDecoder().decode(content);
    driver.close();
    openDrivers.pop();
    return value;
  }

  it('promotes a validated replacement into the canonical path', () => {
    const canonical = path.join(dir, 'project.arq');
    const replacement = path.join(dir, 'migrated.arq');
    writeProject(canonical, 'committed-revision');
    writeProject(replacement, 'migrated-revision');

    const result = commitArqfsFileSwap(canonical, replacement);

    expect(result).toEqual({ status: 'swapped', backupPath: null });
    expect(readMarker(canonical)).toBe('migrated-revision');
    // The replacement was moved, not copied.
    expect(existsSync(replacement)).toBe(false);
  });

  it('retains the previous revision at the backup path when asked', () => {
    const canonical = path.join(dir, 'project.arq');
    const replacement = path.join(dir, 'migrated.arq');
    writeProject(canonical, 'committed-revision');
    writeProject(replacement, 'migrated-revision');

    const result = commitArqfsFileSwap(canonical, replacement, { retainBackup: true });

    expect(result.status).toBe('swapped');
    if (result.status !== 'swapped' || result.backupPath === null) throw new Error('no backup');
    expect(readMarker(canonical)).toBe('migrated-revision');
    expect(readMarker(result.backupPath)).toBe('committed-revision');
  });

  it('creates the canonical file when none existed yet', () => {
    const canonical = path.join(dir, 'new-project.arq');
    const replacement = path.join(dir, 'prepared.arq');
    writeProject(replacement, 'first-revision');

    expect(commitArqfsFileSwap(canonical, replacement)).toEqual({
      status: 'swapped',
      backupPath: null,
    });
    expect(readMarker(canonical)).toBe('first-revision');
  });

  it('refuses to promote a file onto itself', () => {
    const canonical = path.join(dir, 'project.arq');
    writeProject(canonical, 'committed-revision');

    expect(commitArqfsFileSwap(canonical, canonical)).toMatchObject({
      status: 'rejected',
      code: 'ARQ_SWAP_SAME_PATH',
      canonicalPreserved: true,
    });
    expect(readMarker(canonical)).toBe('committed-revision');
  });

  it('rejects a missing replacement without touching the canonical file', () => {
    const canonical = path.join(dir, 'project.arq');
    writeProject(canonical, 'committed-revision');

    expect(commitArqfsFileSwap(canonical, path.join(dir, 'does-not-exist.arq'))).toMatchObject({
      status: 'rejected',
      code: 'ARQ_SWAP_REPLACEMENT_MISSING',
    });
    expect(readMarker(canonical)).toBe('committed-revision');
  });

  /**
   * The core safety property: a replacement that is not a sound arqfs file must
   * never become canonical, however plausible its filename looks.
   */
  it('rejects a corrupt replacement and leaves the committed revision in place', () => {
    const canonical = path.join(dir, 'project.arq');
    const replacement = path.join(dir, 'corrupt.arq');
    writeProject(canonical, 'committed-revision');
    writeFileSync(replacement, Buffer.from('this is definitely not a SQLite database'));

    const result = commitArqfsFileSwap(canonical, replacement);

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'ARQ_SWAP_REPLACEMENT_INVALID',
      canonicalPreserved: true,
    });
    expect(readMarker(canonical)).toBe('committed-revision');
    expect(existsSync(`${canonical}.backup`)).toBe(false);
  });

  it('refuses to overwrite an existing backup rather than destroying an earlier revision', () => {
    const canonical = path.join(dir, 'project.arq');
    const replacement = path.join(dir, 'migrated.arq');
    writeProject(canonical, 'committed-revision');
    writeProject(replacement, 'migrated-revision');
    writeProject(`${canonical}.backup`, 'earlier-revision');

    expect(commitArqfsFileSwap(canonical, replacement)).toMatchObject({
      status: 'rejected',
      code: 'ARQ_SWAP_BACKUP_EXISTS',
      canonicalPreserved: true,
    });
    expect(readMarker(canonical)).toBe('committed-revision');
    expect(readMarker(`${canonical}.backup`)).toBe('earlier-revision');
  });

  // --- failure injection -------------------------------------------------------

  it('leaves the committed revision intact when the process dies after the backup, before the rename', () => {
    const canonical = path.join(dir, 'project.arq');
    const replacement = path.join(dir, 'migrated.arq');
    writeProject(canonical, 'committed-revision');
    writeProject(replacement, 'migrated-revision');

    const result = commitArqfsFileSwap(canonical, replacement, {
      onStage: (stage) => {
        if (stage === 'after-backup') throw new Error('crash before rename');
      },
    });

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'ARQ_SWAP_FAILED',
      canonicalPreserved: true,
    });
    expect(readMarker(canonical)).toBe('committed-revision');
    // No debris: neither a stale backup nor a half-promoted replacement.
    expect(existsSync(`${canonical}.backup`)).toBe(false);
    expect(existsSync(replacement)).toBe(true);
  });

  it('rolls the committed revision back when the process dies after the rename', () => {
    const canonical = path.join(dir, 'project.arq');
    const replacement = path.join(dir, 'migrated.arq');
    writeProject(canonical, 'committed-revision');
    writeProject(replacement, 'migrated-revision');

    const result = commitArqfsFileSwap(canonical, replacement, {
      onStage: (stage) => {
        if (stage === 'after-rename') throw new Error('crash after rename');
      },
    });

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'ARQ_SWAP_FAILED',
      canonicalPreserved: true,
    });
    // The last committed revision is what a user reopens, not the abandoned swap.
    expect(readMarker(canonical)).toBe('committed-revision');
    expect(existsSync(`${canonical}.backup`)).toBe(false);
  });

  it('removes a partially promoted file when the canonical path did not exist before', () => {
    const canonical = path.join(dir, 'new-project.arq');
    const replacement = path.join(dir, 'prepared.arq');
    writeProject(replacement, 'first-revision');

    const result = commitArqfsFileSwap(canonical, replacement, {
      onStage: (stage) => {
        if (stage === 'after-rename') throw new Error('crash after rename');
      },
    });

    expect(result).toMatchObject({ status: 'rejected', canonicalPreserved: true });
    // Nothing was committed before, so nothing may be left behind pretending to be.
    expect(existsSync(canonical)).toBe(false);
  });

  /**
   * A stale write-ahead log from the replaced revision must not survive next to a
   * brand-new canonical file - SQLite would replay another database's log into it.
   */
  it("does not leave the replaced revision's WAL and SHM sidecars beside the new file", () => {
    const canonical = path.join(dir, 'project.arq');
    const replacement = path.join(dir, 'migrated.arq');

    const walDriver = createNodeArqfsDriver(canonical);
    createArqfsSchemaV1(walDriver);
    walDriver.exec('PRAGMA journal_mode = WAL');
    putArchiveEntry(walDriver, 'manifest.json', bytes('committed-revision'));
    // Leave the sidecars on disk exactly as an unclean shutdown would.
    expect(existsSync(`${canonical}-wal`)).toBe(true);

    writeProject(replacement, 'migrated-revision');
    const result = commitArqfsFileSwap(canonical, replacement, {
      validateReplacement: () => ({ ok: true }),
    });
    walDriver.close();

    expect(result.status).toBe('swapped');
    expect(existsSync(`${canonical}-wal`)).toBe(false);
    expect(existsSync(`${canonical}-shm`)).toBe(false);
    expect(readMarker(canonical)).toBe('migrated-revision');
  });

  it('restores the parked sidecars when the swap is abandoned after the rename', () => {
    const canonical = path.join(dir, 'project.arq');
    const replacement = path.join(dir, 'migrated.arq');

    // The connection stays open for the whole swap: closing it cleanly would
    // checkpoint and delete the sidecar, which is the opposite of the unclean
    // shutdown this test needs to model.
    const walDriver = createNodeArqfsDriver(canonical);
    createArqfsSchemaV1(walDriver);
    walDriver.exec('PRAGMA journal_mode = WAL');
    putArchiveEntry(walDriver, 'manifest.json', bytes('committed-revision'));
    const walBefore = readFileSync(`${canonical}-wal`);

    writeProject(replacement, 'migrated-revision');
    const result = commitArqfsFileSwap(canonical, replacement, {
      validateReplacement: () => ({ ok: true }),
      onStage: (stage) => {
        if (stage === 'after-rename') throw new Error('crash after rename');
      },
    });
    walDriver.close();

    expect(result).toMatchObject({ status: 'rejected', canonicalPreserved: true });
    expect(existsSync(`${canonical}-wal`)).toBe(true);
    expect(readFileSync(`${canonical}-wal`)).toEqual(walBefore);
  });
});

describe('validateArqfsFileForSwap', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arqfs-swap-validate-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('accepts a real arqfs file', () => {
    const filePath = path.join(dir, 'project.arq');
    const driver = createNodeArqfsDriver(filePath);
    createArqfsSchemaV1(driver);
    driver.close();

    expect(validateArqfsFileForSwap(filePath)).toEqual({ ok: true });
  });

  it('rejects a file that is not a SQLite database at all', () => {
    const filePath = path.join(dir, 'not-sqlite.arq');
    writeFileSync(filePath, Buffer.from('plain text'));

    expect(validateArqfsFileForSwap(filePath).ok).toBe(false);
  });

  it('rejects a SQLite database that is not an arqfs project', () => {
    const filePath = path.join(dir, 'other.sqlite3');
    const driver = createNodeArqfsDriver(filePath);
    driver.exec('CREATE TABLE unrelated (id INTEGER PRIMARY KEY)');
    driver.close();

    expect(validateArqfsFileForSwap(filePath).ok).toBe(false);
  });
});

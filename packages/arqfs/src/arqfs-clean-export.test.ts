import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putArchiveEntry, getArchiveEntry } from './arqfs-archive-store';
import { openArqfs } from './arqfs-open';
import { exportCleanArqfsCopy } from './arqfs-clean-export';
import type { ArqfsDriver } from './arqfs-driver';

describe('exportCleanArqfsCopy', () => {
  let dir: string;
  let driver: ArqfsDriver;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arqfs-clean-export-'));
  });

  afterEach(() => {
    driver?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('produces a clean copy with no WAL or SHM sidecar files, even when the source is in WAL mode', () => {
    const sourcePath = path.join(dir, 'source.sqlite3');
    const targetPath = path.join(dir, 'export.sqlite3');
    driver = createNodeArqfsDriver(sourcePath);
    createArqfsSchemaV1(driver);
    driver.exec('PRAGMA journal_mode = WAL');
    putArchiveEntry(driver, 'model.json', new TextEncoder().encode('{"walls":[]}'));

    const result = exportCleanArqfsCopy(driver, targetPath);

    expect(result).toEqual({ status: 'exported' });
    expect(existsSync(targetPath)).toBe(true);
    expect(existsSync(`${targetPath}-wal`)).toBe(false);
    expect(existsSync(`${targetPath}-shm`)).toBe(false);
  });

  it('the exported copy is itself a valid, openable arqfs file with the same content', () => {
    const sourcePath = path.join(dir, 'source.sqlite3');
    const targetPath = path.join(dir, 'export.sqlite3');
    driver = createNodeArqfsDriver(sourcePath);
    createArqfsSchemaV1(driver);
    putArchiveEntry(driver, 'model.json', new TextEncoder().encode('{"walls":[]}'));

    exportCleanArqfsCopy(driver, targetPath);

    const exportedDriver = createNodeArqfsDriver(targetPath);
    try {
      const openResult = openArqfs(exportedDriver);
      expect(openResult.status).toBe('opened');
      expect(getArchiveEntry(exportedDriver, 'model.json')).toEqual(
        new TextEncoder().encode('{"walls":[]}'),
      );
    } finally {
      exportedDriver.close();
    }
  });

  it('rejects rather than throws when the target path already has a file', () => {
    const sourcePath = path.join(dir, 'source.sqlite3');
    const targetPath = path.join(dir, 'export.sqlite3');
    driver = createNodeArqfsDriver(sourcePath);
    createArqfsSchemaV1(driver);

    expect(exportCleanArqfsCopy(driver, targetPath)).toEqual({ status: 'exported' });
    expect(exportCleanArqfsCopy(driver, targetPath)).toEqual({
      status: 'rejected',
      reason: 'target-exists',
    });
  });
});

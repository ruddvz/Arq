import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { createArqfsSchemaLatest } from './arqfs-schema-v2';
import { putArchiveEntry } from './arqfs-archive-store';
import { preflightArqfsBytes } from './arqfs-preflight';
import type { ArqfsDriver } from './arqfs-driver';

/**
 * The existing preflight tests build synthetic headers by hand, which proves the
 * rejection arithmetic but not that a genuinely valid file produced by this package
 * is accepted. These fixtures are real SQLite files written to disk in each journal
 * mode, so a header check that is too strict fails here rather than in the field.
 */
describe('preflight against real on-disk fixtures', () => {
  let dir: string;
  let driver: ArqfsDriver;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arqfs-preflight-fixtures-'));
  });

  afterEach(() => {
    try {
      driver?.close();
    } catch {
      // Some fixtures close their own driver.
    }
    rmSync(dir, { recursive: true, force: true });
  });

  function writeFixture(name: string, journalMode: string, latestSchema = false): string {
    const filePath = path.join(dir, name);
    driver = createNodeArqfsDriver(filePath);
    driver.exec(`PRAGMA journal_mode = ${journalMode}`);
    if (latestSchema) {
      createArqfsSchemaLatest(driver, createArqfsSchemaV1);
    } else {
      createArqfsSchemaV1(driver);
    }
    putArchiveEntry(driver, 'manifest.json', new TextEncoder().encode('{"project":"fixture"}'));
    driver.close();
    return filePath;
  }

  const readBytes = (filePath: string): Uint8Array => new Uint8Array(readFileSync(filePath));

  it('accepts a schema v1 file written in rollback-journal (delete) mode', () => {
    const filePath = writeFixture('v1-delete.arq', 'delete');
    const result = preflightArqfsBytes(readBytes(filePath));

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    // Legacy journalling declares file format version 1 in both header slots.
    expect(result.writeVersion).toBe(1);
    expect(result.readVersion).toBe(1);
    expect(result.applicationId).toBe(0x41525131);
  });

  it('accepts a file left in WAL mode, which declares file format version 2', () => {
    const filePath = writeFixture('v1-wal.arq', 'WAL');
    const result = preflightArqfsBytes(readBytes(filePath));

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    expect(result.writeVersion).toBe(2);
    expect(result.readVersion).toBe(2);
  });

  it('accepts a schema v2 file', () => {
    const filePath = writeFixture('v2.arq', 'delete', true);
    const result = preflightArqfsBytes(readBytes(filePath));

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    expect(result.schemaVersion).toBeGreaterThan(0);
  });

  it('reports a page count consistent with the file size', () => {
    const filePath = writeFixture('page-count.arq', 'delete');
    const fileBytes = readBytes(filePath);
    const result = preflightArqfsBytes(fileBytes);

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    expect(result.estimatedPageCount).toBe(fileBytes.byteLength / result.pageSize);
  });

  it('rejects a real file truncated mid-page', () => {
    const filePath = writeFixture('truncated.arq', 'delete');
    const fullSize = readBytes(filePath).byteLength;
    truncateSync(filePath, fullSize - 128);

    expect(preflightArqfsBytes(readBytes(filePath))).toMatchObject({
      status: 'rejected',
      code: 'ARQ_FILE_TRUNCATED',
    });
  });

  /**
   * Whole pages removed, so the bytes still divide evenly - only the header's own
   * declared page count reveals that content is missing.
   */
  it('rejects a real file whose trailing pages were removed', () => {
    const filePath = writeFixture('short.arq', 'delete');
    const fileBytes = readBytes(filePath);
    const pageSize = 4096;
    expect(fileBytes.byteLength).toBeGreaterThan(pageSize * 2);
    truncateSync(filePath, fileBytes.byteLength - pageSize);

    expect(preflightArqfsBytes(readBytes(filePath))).toMatchObject({
      status: 'rejected',
      code: 'ARQ_FILE_TRUNCATED',
    });
  });

  it('rejects a valid SQLite database that is not an Arq project', () => {
    const filePath = path.join(dir, 'other.sqlite3');
    driver = createNodeArqfsDriver(filePath);
    driver.exec('CREATE TABLE unrelated (id INTEGER PRIMARY KEY)');
    driver.close();

    expect(preflightArqfsBytes(readBytes(filePath))).toMatchObject({
      status: 'rejected',
      code: 'ARQ_APPLICATION_ID_MISMATCH',
    });
  });

  it('rejects a file whose SQLite signature was overwritten', () => {
    const filePath = writeFixture('clobbered.arq', 'delete');
    const fileBytes = readFileSync(filePath);
    fileBytes.write('NOT SQLITE FMT\0\0', 0, 16, 'utf8');
    writeFileSync(filePath, fileBytes);

    expect(preflightArqfsBytes(readBytes(filePath)).status).toBe('rejected');
  });
});

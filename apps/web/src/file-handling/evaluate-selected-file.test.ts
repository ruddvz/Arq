import { describe, expect, it } from 'vitest';
import { createNodeArqfsDriver, createArqfsSchemaV1, putArchiveEntry } from '@arq/arqfs';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { evaluateSelectedFile } from './evaluate-selected-file';

/**
 * Uses the real Node driver (test-only - see arqfs-node-driver.ts's own doc
 * comment) purely to produce a genuine, byte-for-byte real arqfs file on disk
 * to evaluate, so this test exercises the exact preflight logic a real upload
 * would hit rather than a hand-built byte array standing in for one.
 */
describe('evaluateSelectedFile', () => {
  it('routes a real arqfs project through open-native-arq and accepts it at the preflight gate', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'evaluate-selected-file-'));
    try {
      const filePath = path.join(dir, 'project.arq');
      const driver = createNodeArqfsDriver(filePath);
      createArqfsSchemaV1(driver);
      putArchiveEntry(driver, 'manifest.json', new TextEncoder().encode('{}'));
      driver.close();

      const bytes = new Uint8Array(readFileSync(filePath));
      const result = evaluateSelectedFile(bytes, 'project.arq');

      expect(result.route.kind).toBe('open-native-arq');
      expect(result.preflight?.status).toBe('accepted');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a truncated arqfs file at the byte-preflight gate before any driver would ever open it', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'evaluate-selected-file-'));
    try {
      const filePath = path.join(dir, 'project.arq');
      const driver = createNodeArqfsDriver(filePath);
      createArqfsSchemaV1(driver);
      driver.close();

      const fullBytes = readFileSync(filePath);
      const truncated = new Uint8Array(fullBytes.subarray(0, fullBytes.byteLength - 100));
      const result = evaluateSelectedFile(truncated, 'project.arq');

      expect(result.route.kind).toBe('open-native-arq');
      expect(result.preflight).toMatchObject({ status: 'rejected', code: 'ARQ_FILE_TRUNCATED' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('routes a non-Arq SQLite database to rejection without ever running the arqfs preflight', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'evaluate-selected-file-'));
    try {
      const filePath = path.join(dir, 'other.sqlite3');
      const driver = createNodeArqfsDriver(filePath);
      driver.exec('CREATE TABLE unrelated (id INTEGER PRIMARY KEY)');
      driver.close();

      const bytes = new Uint8Array(readFileSync(filePath));
      const result = evaluateSelectedFile(bytes, 'other.sqlite3');

      expect(result.route).toMatchObject({ kind: 'reject', code: 'NOT_ARQ_SQLITE' });
      expect(result.preflight).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('routes a DXF file to import without running the arqfs preflight', () => {
    const bytes = new TextEncoder().encode('0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n');
    const result = evaluateSelectedFile(bytes, 'plan.dxf');

    expect(result.route).toMatchObject({ kind: 'import', formatId: 'dxf' });
    expect(result.preflight).toBeUndefined();
  });

  /**
   * routeBrowserFile has exactly two 'reject' cases: a SQLite database that
   * is not an Arq project, and an Arq-application-ID file whose header is
   * itself invalid. Content with no recognised signature at all is never
   * silently dropped - it routes to 'import' as format 'unknown', which a
   * caller can surface honestly ("unrecognised file") rather than pretending
   * detection failed outright.
   */
  it('routes genuinely unrecognisable content to import as format "unknown", not a reject', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const result = evaluateSelectedFile(bytes, 'mystery.bin');

    expect(result.route).toMatchObject({ kind: 'import', formatId: 'unknown' });
    expect(result.preflight).toBeUndefined();
  });
});

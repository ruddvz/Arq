import { describe, expect, it, afterEach } from 'vitest';
import { createManifest, exportArchive } from '@arq/project-format';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import {
  putArchiveEntry,
  putArchiveEntries,
  getArchiveEntry,
  listArchiveEntryPaths,
  readAllArchiveEntries,
} from './arqfs-archive-store';
import type { ArqfsDriver } from './arqfs-driver';

describe('arqfs-archive-store', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  it('round-trips a single entry byte-for-byte', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    const content = new TextEncoder().encode('{"hello":"world"}');
    putArchiveEntry(driver, 'model.json', content);

    expect(getArchiveEntry(driver, 'model.json')).toEqual(content);
  });

  it('returns null for a path that was never stored', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    expect(getArchiveEntry(driver, 'does-not-exist.json')).toBeNull();
  });

  it('overwrites an existing entry on conflict rather than duplicating rows', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    putArchiveEntry(driver, 'model.json', new TextEncoder().encode('v1'));
    putArchiveEntry(driver, 'model.json', new TextEncoder().encode('v2'));

    expect(getArchiveEntry(driver, 'model.json')).toEqual(new TextEncoder().encode('v2'));
    expect(listArchiveEntryPaths(driver)).toEqual(['model.json']);
  });

  it('lists paths sorted, and reads every entry back into the same Map shape as project-format archives use', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    const entries = new Map<string, Uint8Array>([
      ['model.json', new TextEncoder().encode('{}')],
      ['manifest.json', new TextEncoder().encode('{}')],
      ['operations.ndjson', new TextEncoder().encode('')],
    ]);
    putArchiveEntries(driver, entries);

    expect(listArchiveEntryPaths(driver)).toEqual([
      'manifest.json',
      'model.json',
      'operations.ndjson',
    ]);
    expect(readAllArchiveEntries(driver)).toEqual(entries);
  });

  it('stores and reads back a real @arq/project-format exportArchive output unchanged', async () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    const manifest = createManifest({ projectId: 'proj-1', applicationVersion: '0.1.0' });
    const built = await exportArchive({
      manifest,
      model: { walls: [{ id: 'w1', fromMm: { x: 0, y: 0 }, toMm: { x: 4000, y: 0 } }] },
      operations: [{ kind: 'CreateWall', id: 'w1' }],
    });

    putArchiveEntries(driver, built);
    const readBack = readAllArchiveEntries(driver);

    expect(readBack.size).toBe(built.size);
    for (const [path, content] of built) {
      expect(readBack.get(path)).toEqual(content);
    }
  });
});

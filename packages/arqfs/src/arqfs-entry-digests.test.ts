import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putArchiveEntry, readAllArchiveEntries } from './arqfs-archive-store';
import { verifyArqfsEntryDigests, classifyEntryPath } from './arqfs-entry-digests';
import { computeChecksums, serializeChecksums } from '@arq/project-format/src/checksum';
import type { ArqfsDriver } from './arqfs-driver';

const encoder = new TextEncoder();

/** Writes entries plus a checksums.json that genuinely covers them. */
async function seedProject(
  driver: ArqfsDriver,
  entries: ReadonlyMap<string, Uint8Array>,
): Promise<void> {
  for (const [entryPath, content] of entries) {
    putArchiveEntry(driver, entryPath, content);
  }
  const checksums = await computeChecksums(entries);
  putArchiveEntry(driver, 'checksums.json', encoder.encode(serializeChecksums(checksums)));
}

function baseEntries(): Map<string, Uint8Array> {
  return new Map([
    ['manifest.json', encoder.encode('{"schemaVersion":1}')],
    ['model.json', encoder.encode('{"walls":[{"id":"w1"}]}')],
  ]);
}

describe('classifyEntryPath', () => {
  it('treats the format’s own required entries as canonical', () => {
    expect(classifyEntryPath('manifest.json')).toBe('canonical');
    expect(classifyEntryPath('model.json')).toBe('canonical');
    expect(classifyEntryPath('operations.ndjson')).toBe('canonical');
  });

  it('treats regenerable caches as derived', () => {
    expect(classifyEntryPath('thumbnails/plan.png')).toBe('derived');
    expect(classifyEntryPath('render-cache/level-0.bin')).toBe('derived');
  });

  /**
   * The conservative direction. A future writer's canonical entry must not
   * become discardable just because this build has not heard of it.
   */
  it('treats an unrecognised entry as unknown rather than derived', () => {
    expect(classifyEntryPath('constraints.json')).toBe('unknown');
  });
});

describe('verifyArqfsEntryDigests', () => {
  let dir: string;
  let driver: ArqfsDriver;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arqfs-digests-'));
    driver = createNodeArqfsDriver(path.join(dir, 'project.sqlite3'));
    createArqfsSchemaV1(driver);
  });

  afterEach(() => {
    driver?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('verifies a project whose entries match their recorded digests', async () => {
    await seedProject(driver, baseEntries());

    const report = await verifyArqfsEntryDigests(driver);

    expect(report.ok).toBe(true);
    expect(report.checksumsPresent).toBe(true);
    expect(report.verifiedEntryCount).toBe(2);
    expect(report.canonicalMismatches).toEqual([]);
  });

  it('fails when a canonical entry’s bytes no longer match its digest', async () => {
    await seedProject(driver, baseEntries());
    // Rewrite model.json without updating checksums.json: the exact shape of a
    // silent content corruption.
    putArchiveEntry(driver, 'model.json', encoder.encode('{"walls":[]}'));

    const report = await verifyArqfsEntryDigests(driver);

    expect(report.ok).toBe(false);
    expect(report.canonicalMismatches).toEqual(['model.json']);
    expect(report.missingCanonicalEntries).toEqual([]);
  });

  it('separates a canonical entry that vanished from one that changed', async () => {
    await seedProject(driver, baseEntries());
    driver.run('DELETE FROM archive_entry WHERE path = ?', ['model.json']);

    const report = await verifyArqfsEntryDigests(driver);

    expect(report.ok).toBe(false);
    expect(report.missingCanonicalEntries).toEqual(['model.json']);
    expect(report.canonicalMismatches).toEqual([]);
  });

  /**
   * The distinction this module exists for: a corrupt thumbnail and a corrupt
   * model are both checksum mismatches and are not the same event.
   */
  it('does not fail a project for a regenerable derived entry', async () => {
    const entries = baseEntries();
    entries.set('thumbnails/plan.png', encoder.encode('original-image-bytes'));
    await seedProject(driver, entries);
    putArchiveEntry(driver, 'thumbnails/plan.png', encoder.encode('different-bytes'));

    const report = await verifyArqfsEntryDigests(driver);

    expect(report.ok).toBe(true);
    expect(report.derivedMismatches).toEqual(['thumbnails/plan.png']);
    expect(report.canonicalMismatches).toEqual([]);
  });

  it('fails on an unrecognised entry, rather than assuming it is discardable', async () => {
    const entries = baseEntries();
    entries.set('constraints.json', encoder.encode('{"constraints":[]}'));
    await seedProject(driver, entries);
    putArchiveEntry(driver, 'constraints.json', encoder.encode('{"constraints":[1]}'));

    const report = await verifyArqfsEntryDigests(driver);

    expect(report.ok).toBe(false);
    expect(report.unknownMismatches).toEqual(['constraints.json']);
  });

  /**
   * An absent or unreadable checksums.json means the check did not run. That is
   * a missing check, not a detected fault, and the two must be distinguishable
   * by a caller - hence a separate flag rather than one boolean.
   */
  it('reports that nothing was verified when checksums.json is absent', async () => {
    for (const [entryPath, content] of baseEntries()) {
      putArchiveEntry(driver, entryPath, content);
    }

    const report = await verifyArqfsEntryDigests(driver);

    expect(report.checksumsPresent).toBe(false);
    expect(report.ok).toBe(true);
    expect(report.verifiedEntryCount).toBe(0);
  });

  it('reports that nothing was verified when checksums.json is malformed', async () => {
    await seedProject(driver, baseEntries());
    putArchiveEntry(driver, 'checksums.json', encoder.encode('not json at all'));

    const report = await verifyArqfsEntryDigests(driver);

    expect(report.checksumsPresent).toBe(false);
    expect(report.verifiedEntryCount).toBe(0);
  });

  it('leaves the project unchanged while verifying', async () => {
    await seedProject(driver, baseEntries());
    const before = readAllArchiveEntries(driver);

    await verifyArqfsEntryDigests(driver);

    expect(readAllArchiveEntries(driver)).toEqual(before);
  });
});

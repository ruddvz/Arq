import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, rmSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putArchiveEntry } from './arqfs-archive-store';
import { initializeWorkingCopyState, readWorkingCopyState } from './arqfs-working-copy';
import { computeProjectSemanticHash, SEMANTIC_HASH_SCHEME } from './arqfs-semantic-hash';
import {
  publishProjectFile,
  recordPublicationOutcome,
  type ArqfsPublicationEnvironment,
} from './arqfs-publication';
import { computeChecksums, serializeChecksums } from '@arq/project-format/src/checksum';
import type { ArqfsDriver } from './arqfs-driver';

describe('publishProjectFile', () => {
  let dir: string;
  let driver: ArqfsDriver;
  /** Readers the environment handed out, so each test can prove they were closed. */
  let openedReaders: { readonly driver: ArqfsDriver; closed: boolean }[];

  /**
   * The Node-backed host. Deliberately opens the target path anew for every
   * verification rather than reusing `driver`: reusing the writer's handle is the
   * exact mistake this module exists to prevent, so the tests must not model it.
   */
  function nodeEnvironment(
    overrides: Partial<ArqfsPublicationEnvironment> = {},
  ): ArqfsPublicationEnvironment {
    return {
      openFreshReader: (targetPath) => {
        const reader = createNodeArqfsDriver(targetPath);
        const record = { driver: reader, closed: false };
        openedReaders.push(record);
        return {
          ...reader,
          close: () => {
            record.closed = true;
            reader.close();
          },
        };
      },
      listSidecars: (targetPath) =>
        [`${targetPath}-wal`, `${targetPath}-shm`].filter((sidecar) => existsSync(sidecar)),
      byteLength: (targetPath) => statSync(targetPath).size,
      ...overrides,
    };
  }

  function workingProject(filePath: string): ArqfsDriver {
    const created = createNodeArqfsDriver(filePath);
    createArqfsSchemaV1(created);
    initializeWorkingCopyState(created, 'project-alpha');
    putArchiveEntry(created, 'model.json', new TextEncoder().encode('{"walls":[{"id":"w1"}]}'));
    putArchiveEntry(created, 'levels.json', new TextEncoder().encode('{"levels":["L0"]}'));
    return created;
  }

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arqfs-publication-'));
    openedReaders = [];
  });

  afterEach(() => {
    driver?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('publishes an exact revision and returns a receipt a fresh reader established', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));
    const expectedHash = await computeProjectSemanticHash(driver);

    const result = await publishProjectFile(driver, target, nodeEnvironment());

    expect(result.status).toBe('published');
    if (result.status !== 'published') return;
    expect(result.receipt).toMatchObject({
      projectId: 'project-alpha',
      revision: 0,
      semanticHash: expectedHash,
      semanticHashScheme: SEMANTIC_HASH_SCHEME,
      entryCount: 2,
      targetPath: target,
      verifiedBy: 'fresh-reader',
    });
    expect(result.receipt.byteLength).toBeGreaterThan(0);
  });

  it('leaves the published file free of WAL and SHM sidecars even from a WAL-mode working project', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));
    driver.exec('PRAGMA journal_mode = WAL');
    putArchiveEntry(driver, 'sheets.json', new TextEncoder().encode('{"sheets":[]}'));

    const result = await publishProjectFile(driver, target, nodeEnvironment());

    expect(result.status).toBe('published');
    expect(existsSync(`${target}-wal`)).toBe(false);
    expect(existsSync(`${target}-shm`)).toBe(false);
  });

  it('closes the fresh reader on the success path, leaving no verification handle open', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));

    await publishProjectFile(driver, target, nodeEnvironment());

    expect(openedReaders).toHaveLength(1);
    expect(openedReaders.every((reader) => reader.closed)).toBe(true);
  });

  it('closes the fresh reader on a refusal path too', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));

    // Refuse at the last check, so a reader has definitely been opened first.
    const result = await publishProjectFile(
      driver,
      target,
      nodeEnvironment({ listSidecars: () => [`${target}-wal`] }),
    );

    expect(result.status).toBe('refused');
    expect(openedReaders).toHaveLength(1);
    expect(openedReaders.every((reader) => reader.closed)).toBe(true);
  });

  /**
   * The case the whole module exists for. The bytes are written, SQLite still
   * considers the file sound, and the writer's own handle would report success -
   * only an independent reader recomputing the hash notices the meaning changed.
   */
  it('refuses when the published file no longer means what the working project means', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));

    const result = await publishProjectFile(
      driver,
      target,
      nodeEnvironment({
        openFreshReader: (targetPath) => {
          const reader = createNodeArqfsDriver(targetPath);
          // A dropped entry: exactly what a lossy export or a partial write leaves
          // behind, and invisible to `PRAGMA quick_check`.
          reader.run('DELETE FROM archive_entry WHERE path = ?', ['levels.json']);
          return reader;
        },
      }),
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.reason).toBe('semantic-mismatch');
    expect(result.targetWritten).toBe(true);
  });

  /**
   * V3-069 wired into the publication sequence: a canonical entry whose bytes
   * no longer match `checksums.json` must stop the publication, even though
   * SQLite considers the file sound and the semantic hash is recomputed from
   * those same corrupted bytes and therefore agrees with itself.
   */
  it('refuses when a canonical entry no longer matches its recorded digest', async () => {
    const target = path.join(dir, 'published.arq');
    driver = createNodeArqfsDriver(path.join(dir, 'working.sqlite3'));
    createArqfsSchemaV1(driver);
    initializeWorkingCopyState(driver, 'project-alpha');
    const entries = new Map([
      ['manifest.json', new TextEncoder().encode('{"schemaVersion":1}')],
      ['model.json', new TextEncoder().encode('{"walls":[{"id":"w1"}]}')],
    ]);
    for (const [entryPath, content] of entries) {
      putArchiveEntry(driver, entryPath, content);
    }
    const checksums = await computeChecksums(entries);
    putArchiveEntry(
      driver,
      'checksums.json',
      new TextEncoder().encode(serializeChecksums(checksums)),
    );

    const result = await publishProjectFile(
      driver,
      target,
      nodeEnvironment({
        openFreshReader: (targetPath) => {
          const reader = createNodeArqfsDriver(targetPath);
          reader.run('UPDATE archive_entry SET content = ? WHERE path = ?', [
            new TextEncoder().encode('{"walls":[]}'),
            'model.json',
          ]);
          return reader;
        },
      }),
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.reason).toBe('entry-digest-failed');
    expect(result.detail).toContain('model.json');
  });

  it('publishes a project whose canonical entries all match their digests', async () => {
    const target = path.join(dir, 'published.arq');
    driver = createNodeArqfsDriver(path.join(dir, 'working.sqlite3'));
    createArqfsSchemaV1(driver);
    initializeWorkingCopyState(driver, 'project-alpha');
    const entries = new Map([
      ['manifest.json', new TextEncoder().encode('{"schemaVersion":1}')],
      ['model.json', new TextEncoder().encode('{"walls":[{"id":"w1"}]}')],
    ]);
    for (const [entryPath, content] of entries) {
      putArchiveEntry(driver, entryPath, content);
    }
    const checksums = await computeChecksums(entries);
    putArchiveEntry(
      driver,
      'checksums.json',
      new TextEncoder().encode(serializeChecksums(checksums)),
    );

    const result = await publishProjectFile(driver, target, nodeEnvironment());

    expect(result.status).toBe('published');
  });

  it('refuses when the published file holds a different revision than the one published', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));

    const result = await publishProjectFile(
      driver,
      target,
      nodeEnvironment({
        openFreshReader: (targetPath) => {
          const reader = createNodeArqfsDriver(targetPath);
          reader.run('UPDATE working_copy_state SET local_revision = 41 WHERE id = 1');
          return reader;
        },
      }),
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.reason).toBe('revision-drift');
    expect(result.detail).toContain('41');
  });

  it('refuses when the published file holds a different project', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));

    const result = await publishProjectFile(
      driver,
      target,
      nodeEnvironment({
        openFreshReader: (targetPath) => {
          const reader = createNodeArqfsDriver(targetPath);
          reader.run('UPDATE working_copy_state SET project_id = ? WHERE id = 1', ['project-beta']);
          return reader;
        },
      }),
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.reason).toBe('identity-mismatch');
  });

  it('refuses a truncated publication rather than reporting a written file as published', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));

    const result = await publishProjectFile(
      driver,
      target,
      nodeEnvironment({
        openFreshReader: (targetPath) => {
          // Cut the file in half before anyone reads it: the shape a full disk or
          // an interrupted write leaves.
          const bytes = readFileSync(targetPath);
          writeFileSync(targetPath, bytes.subarray(0, Math.floor(bytes.length / 2)));
          return createNodeArqfsDriver(targetPath);
        },
      }),
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    // Whether SQLite rejects the header, fails integrity or loses the row, the
    // one thing that must never happen is a 'published' verdict.
    expect([
      'reader-open-failed',
      'reader-rejected',
      'integrity-failed',
      'identity-mismatch',
    ]).toContain(result.reason);
    expect(result.targetWritten).toBe(true);
  });

  it('refuses rather than throws when the published bytes cannot be opened at all', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));

    const result = await publishProjectFile(
      driver,
      target,
      nodeEnvironment({
        openFreshReader: () => {
          throw new Error('OPFS handle vanished');
        },
      }),
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.reason).toBe('reader-open-failed');
    expect(result.detail).toContain('OPFS handle vanished');
  });

  it('refuses when a sidecar is left beside the published file, since it cannot travel alone', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));

    const result = await publishProjectFile(
      driver,
      target,
      nodeEnvironment({ listSidecars: () => [`${target}-wal`] }),
    );

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.reason).toBe('sidecar-present');
  });

  it('refuses to publish over an existing file and does not claim those bytes as its own', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));
    writeFileSync(target, 'somebody else’s file');

    const result = await publishProjectFile(driver, target, nodeEnvironment());

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.reason).toBe('export-failed');
    expect(result.targetWritten).toBe(false);
    expect(readFileSync(target, 'utf8')).toBe('somebody else’s file');
  });

  it('refuses to publish a revision that is mid-write rather than capturing an uncommitted one', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));
    driver.run("UPDATE working_copy_state SET local_commit_state = 'writing' WHERE id = 1");

    const result = await publishProjectFile(driver, target, nodeEnvironment());

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.reason).toBe('working-copy-not-settled');
    expect(existsSync(target)).toBe(false);
  });

  it('refuses when the caller asked for a revision the working project is not on', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));

    const result = await publishProjectFile(driver, target, nodeEnvironment(), {
      expectedRevision: 7,
    });

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.reason).toBe('revision-not-current');
    expect(existsSync(target)).toBe(false);
  });

  it('publishes when the requested exact revision is the current one', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));

    const result = await publishProjectFile(driver, target, nodeEnvironment(), {
      expectedRevision: 0,
    });

    expect(result.status).toBe('published');
  });

  it('refuses when there is no working-copy state to publish a revision from', async () => {
    const target = path.join(dir, 'published.arq');
    driver = createNodeArqfsDriver(path.join(dir, 'working.sqlite3'));
    createArqfsSchemaV1(driver);

    const result = await publishProjectFile(driver, target, nodeEnvironment());

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.reason).toBe('working-copy-missing');
  });

  /**
   * The promise the failure copy makes to the user - "your changes remain in the
   * working project on this device" - has to be true of the bytes, not just the
   * wording.
   */
  it('leaves the working project unchanged when verification refuses', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));
    const before = await computeProjectSemanticHash(driver);
    const stateBefore = readWorkingCopyState(driver);

    const result = await publishProjectFile(
      driver,
      target,
      nodeEnvironment({ listSidecars: () => [`${target}-wal`] }),
    );

    expect(result.status).toBe('refused');
    expect(await computeProjectSemanticHash(driver)).toBe(before);
    expect(readWorkingCopyState(driver)).toEqual(stateBefore);
  });

  it('leaves the working project unchanged on the success path as well', async () => {
    const target = path.join(dir, 'published.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));
    const before = await computeProjectSemanticHash(driver);
    const stateBefore = readWorkingCopyState(driver);

    const result = await publishProjectFile(driver, target, nodeEnvironment());

    expect(result.status).toBe('published');
    expect(await computeProjectSemanticHash(driver)).toBe(before);
    // Publication records nothing by itself; `recordPublicationOutcome` is the
    // caller's separate, explicit step.
    expect(readWorkingCopyState(driver)).toEqual(stateBefore);
  });

  it('reflects an edit made after a publication in the next publication, not the previous receipt', async () => {
    const first = path.join(dir, 'first.arq');
    const second = path.join(dir, 'second.arq');
    driver = workingProject(path.join(dir, 'working.sqlite3'));

    const firstResult = await publishProjectFile(driver, first, nodeEnvironment());
    putArchiveEntry(driver, 'model.json', new TextEncoder().encode('{"walls":[{"id":"w2"}]}'));
    const secondResult = await publishProjectFile(driver, second, nodeEnvironment());

    expect(firstResult.status).toBe('published');
    expect(secondResult.status).toBe('published');
    if (firstResult.status !== 'published' || secondResult.status !== 'published') return;
    expect(secondResult.receipt.semanticHash).not.toBe(firstResult.receipt.semanticHash);
  });
});

describe('recordPublicationOutcome', () => {
  let dir: string;
  let driver: ArqfsDriver;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arqfs-publication-outcome-'));
  });

  afterEach(() => {
    driver?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('records a verified publication against the working copy', () => {
    driver = createNodeArqfsDriver(path.join(dir, 'working.sqlite3'));
    createArqfsSchemaV1(driver);
    initializeWorkingCopyState(driver, 'project-alpha');

    recordPublicationOutcome(driver, 'current');

    expect(readWorkingCopyState(driver)?.publicationState).toBe('current');
  });

  it('records a failed publication without touching the revision', () => {
    driver = createNodeArqfsDriver(path.join(dir, 'working.sqlite3'));
    createArqfsSchemaV1(driver);
    initializeWorkingCopyState(driver, 'project-alpha');

    recordPublicationOutcome(driver, 'failed');

    const state = readWorkingCopyState(driver);
    expect(state?.publicationState).toBe('failed');
    expect(state?.localRevision).toBe(0);
  });

  it('throws rather than silently recording nothing when there is no working copy row', () => {
    driver = createNodeArqfsDriver(path.join(dir, 'working.sqlite3'));
    createArqfsSchemaV1(driver);

    expect(() => recordPublicationOutcome(driver, 'current')).toThrow(/not initialized/);
  });
});

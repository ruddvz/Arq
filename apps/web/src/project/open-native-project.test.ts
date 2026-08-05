import { describe, expect, it, vi } from 'vitest';
import { createManifest, exportArchive } from '@arq/project-format';
import { openNativeProject, type NativeWorkerHandle } from './open-native-project';

const PROJECT_ID = '00000000-0000-4000-8000-000000000001';

/** A structurally valid Arq SQLite header. `wal` sets the file-format versions SQLite writes for a write-ahead log. */
function sqliteBytes(journal: 'rollback' | 'wal' = 'rollback'): Uint8Array {
  const bytes = new Uint8Array(4096);
  bytes.set(new TextEncoder().encode('SQLite format 3\0'));
  bytes[16] = 0x10;
  const version = journal === 'wal' ? 2 : 1;
  bytes[18] = version;
  bytes[19] = version;
  bytes[21] = 64;
  bytes[22] = 32;
  bytes[23] = 32;
  bytes[63] = 2;
  // Arq application id 0x41525131.
  bytes[68] = 0x41;
  bytes[69] = 0x52;
  bytes[70] = 0x51;
  bytes[71] = 0x31;
  return bytes;
}

const WRITABLE = {
  status: 'opened',
  header: { major: 1, minor: 0, schema: 2, minReaderMajor: 1, minWriterMajor: 1 },
  capabilities: {
    canRead: true,
    canWrite: true,
    canMigrate: false,
    safeModeRequired: false,
    unsupportedRequiredFeatures: [],
  },
} as const;

async function archiveEntries(walls: unknown[] = []) {
  const entries = await exportArchive({
    manifest: createManifest({
      projectId: PROJECT_ID,
      applicationVersion: 'test',
      createdAt: '2026-08-04T00:00:00.000Z',
    }),
    model: { projectName: 'Existing project', walls },
    operations: [],
  });
  return [...entries];
}

/**
 * A fake Worker that answers the pipeline's requests. `overrides` replaces the
 * answer for one request type, which is how each failure path is driven.
 */
function fakeWorker(overrides: Record<string, () => Promise<unknown>> = {}) {
  const terminate = vi.fn();
  const dispose = vi.fn();
  const seen: string[] = [];
  let entries: ReadonlyArray<readonly [string, Uint8Array]> = [];
  const factory = (): NativeWorkerHandle => {
    const client = {
      request: async (request: { type: string }) => {
        seen.push(request.type);
        const override = overrides[request.type];
        if (override) return override();
        if (request.type === 'importDatabase') return { kind: 'importDatabase', byteLength: 0 };
        if (request.type === 'open')
          return { kind: 'open', result: WRITABLE, usedVfs: 'opfs-sahpool' };
        if (request.type === 'checkIntegrity')
          return {
            kind: 'checkIntegrity',
            report: { ok: true, quickCheck: ['ok'], foreignKeyViolations: [] },
          };
        if (request.type === 'readAllArchiveEntries')
          return { kind: 'readAllArchiveEntries', entries };
        return { kind: 'close' };
      },
      dispose,
    };
    return {
      worker: { terminate } as unknown as Worker,
      client: client as unknown as NativeWorkerHandle['client'],
    };
  };
  return {
    factory,
    terminate,
    dispose,
    seen,
    setEntries: (next: ReadonlyArray<readonly [string, Uint8Array]>) => {
      entries = next;
    },
  };
}

describe('openNativeProject', () => {
  it('opens a valid project and returns its decoded contents', async () => {
    const fake = fakeWorker();
    fake.setEntries(
      await archiveEntries([{ id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 } }]),
    );

    const result = await openNativeProject(sqliteBytes(), fake.factory, 'house.arq');

    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.snapshot.projectId).toBe(PROJECT_ID);
      expect(result.snapshot.displayName).toBe('Existing project');
      expect(result.snapshot.walls).toHaveLength(1);
      expect(result.snapshot.readOnly).toBe(false);
      expect(result.snapshot.usedVfs).toBe('opfs-sahpool');
    }
    // The bytes are imported before the open, so the open reads the user's
    // project rather than an empty database this Worker created.
    expect(fake.seen.slice(0, 2)).toEqual(['importDatabase', 'open']);
    // Adopted: the Worker stays alive to serve the session.
    expect(fake.terminate).not.toHaveBeenCalled();
  });

  /**
   * The cheap checks run first and leave nothing behind. A database whose `-wal`
   * sidecar was not supplied must be refused before it can occupy a working
   * copy - if a Worker were constructed first, a refusal would still have cost
   * an OPFS import.
   */
  it('refuses a missing -wal sidecar without constructing a Worker at all', async () => {
    const fake = fakeWorker();

    const result = await openNativeProject(sqliteBytes('wal'), fake.factory, 'house.arq');

    expect(result).toMatchObject({ status: 'rejected', code: 'ARQ_WAL_SIDECAR_REQUIRED' });
    expect(fake.seen).toEqual([]);
    expect(fake.terminate).not.toHaveBeenCalled();
  });

  it('refuses a non-Arq file before constructing a Worker', async () => {
    const fake = fakeWorker();

    const result = await openNativeProject(new Uint8Array(4096), fake.factory, 'notes.txt');

    expect(result).toMatchObject({ status: 'rejected', code: 'ARQ_NOT_SQLITE' });
    expect(fake.seen).toEqual([]);
  });

  /**
   * Every failure past Worker construction must release it. A leaked Worker
   * keeps the OPFS write lock on its working copy, which makes that project
   * unopenable for the rest of the session - so this is the property worth
   * testing on each rejection, not just the returned code.
   */
  it.each([
    [
      'a rejected open',
      {
        open: async () => ({
          kind: 'open',
          result: { status: 'rejected', reason: 'not an Arq file' },
        }),
      },
      'ARQ_OPEN_REJECTED',
    ],
    [
      'a Worker that throws',
      {
        open: async () => {
          throw new Error('worker exploded');
        },
      },
      'ARQ_OPEN_FAILED',
    ],
  ])('releases the Worker after %s', async (_label, overrides, code) => {
    const fake = fakeWorker(overrides as Record<string, () => Promise<unknown>>);

    const result = await openNativeProject(sqliteBytes(), fake.factory, 'house.arq');

    expect(result).toMatchObject({ status: 'rejected', code });
    expect(fake.terminate).toHaveBeenCalledOnce();
    expect(fake.dispose).toHaveBeenCalledOnce();
  });

  it('releases the Worker when the archive has no usable model', async () => {
    const fake = fakeWorker();
    fake.setEntries([]);

    const result = await openNativeProject(sqliteBytes(), fake.factory, 'house.arq');

    expect(result).toMatchObject({ status: 'rejected', code: 'ARQ_ARCHIVE_REJECTED' });
    expect(fake.terminate).toHaveBeenCalledOnce();
  });

  it('opens an older-schema project read-only rather than editable', async () => {
    const fake = fakeWorker({
      open: async () => ({
        kind: 'open',
        result: {
          ...WRITABLE,
          capabilities: { ...WRITABLE.capabilities, canMigrate: true },
        },
        usedVfs: 'opfs-sahpool',
      }),
    });
    fake.setEntries(await archiveEntries());

    const result = await openNativeProject(sqliteBytes(), fake.factory, 'house.arq');

    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.snapshot.readOnly).toBe(true);
      expect(result.snapshot.warnings[0]).toMatch(/migration/i);
    }
  });
});

describe('the working-copy integrity check', () => {
  it('refuses a working copy SQLite reports as damaged, before anything decodes it', async () => {
    const fake = fakeWorker({
      checkIntegrity: () =>
        Promise.resolve({
          kind: 'checkIntegrity',
          report: {
            ok: false,
            quickCheck: ['*** in database main ***', 'Page 42 is never used'],
            foreignKeyViolations: [],
          },
        }),
    });
    fake.setEntries(
      await archiveEntries([{ id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 } }]),
    );

    const result = await openNativeProject(sqliteBytes(), fake.factory, 'house.arq');

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.code).toBe('ARQ_INTEGRITY_FAILED');
      // The real finding, not a generic "damaged file" line.
      expect(result.reason).toContain('Page 42 is never used');
    }
    // Damaged is found before the contents are read, so nothing decodes a page
    // the database itself has just reported as broken.
    expect(fake.seen).not.toContain('readAllArchiveEntries');
    // And the Worker is still released - a leaked one holds the working copy's
    // write lock for the rest of the session.
    expect(fake.terminate).toHaveBeenCalled();
  });

  it('runs the check after the open decision, not before it', async () => {
    const fake = fakeWorker();
    fake.setEntries(await archiveEntries([]));

    await openNativeProject(sqliteBytes(), fake.factory, 'house.arq');

    // Reads are gated on an accepted open, and the integrity check is a read.
    expect(fake.seen.indexOf('checkIntegrity')).toBeGreaterThan(fake.seen.indexOf('open'));
    expect(fake.seen.indexOf('checkIntegrity')).toBeLessThan(
      fake.seen.indexOf('readAllArchiveEntries'),
    );
  });
});

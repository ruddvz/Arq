import { describe, expect, it, vi } from 'vitest';
import { createManifest, exportArchive } from '@arq/project-format';
import { openNativeProject, type NativeWorkerHandle } from './open-native-project';
import type { ArqfsWriterLease } from '@arq/arqfs/src/arqfs-single-writer-lock';

/**
 * Grants the writer lock. Injected rather than left to the real implementation
 * because jsdom has no `navigator.locks`, and the real one correctly degrades to
 * a read-only lease when it is absent - so a test that did not inject would
 * exercise only that branch and quietly assert nothing about the writable path.
 */
const releaseWriterLease = vi.fn();
function grantsWriterLock(): Promise<ArqfsWriterLease> {
  return Promise.resolve({ status: 'writer', handle: { release: releaseWriterLease } });
}
function refusesWriterLock(
  reason:
    | 'another-context-is-writing'
    | 'locks-unavailable'
    | 'lock-request-refused' = 'another-context-is-writing',
): () => Promise<ArqfsWriterLease> {
  return () => Promise.resolve({ status: 'read-only', reason });
}

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

    const result = await openNativeProject(
      sqliteBytes(),
      fake.factory,
      'house.arq',
      undefined,
      null,
      grantsWriterLock,
    );

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

    const result = await openNativeProject(
      sqliteBytes('wal'),
      fake.factory,
      'house.arq',
      undefined,
      null,
      grantsWriterLock,
    );

    expect(result).toMatchObject({ status: 'rejected', code: 'ARQ_WAL_SIDECAR_REQUIRED' });
    expect(fake.seen).toEqual([]);
    expect(fake.terminate).not.toHaveBeenCalled();
  });

  /**
   * The working copy is content-addressed, so choosing the same file again names
   * the working copy the live session already holds. A second Worker cannot take
   * it - so before this was recognised, choosing the open project reported "could
   * not be opened" about a project sitting on screen.
   */
  it('recognises the project already open instead of building a second Worker for it', async () => {
    const fake = fakeWorker();
    fake.setEntries(await archiveEntries());
    const bytes = sqliteBytes();

    const first = await openNativeProject(
      bytes,
      fake.factory,
      'house.arq',
      undefined,
      null,
      grantsWriterLock,
    );
    expect(first.status).toBe('opened');
    if (first.status !== 'opened') return;
    const held = first.snapshot.workingCopyId;

    const seenBefore = [...fake.seen];
    const again = await openNativeProject(bytes, fake.factory, 'house.arq', undefined, held);

    expect(again).toEqual({ status: 'already-open', workingCopyId: held });
    // Recognised before anything is constructed, like every other answer this
    // function can give without a Worker.
    expect(fake.seen).toEqual(seenBefore);
    // And the live session is left alone: it is the one the reader is using.
    expect(fake.terminate).not.toHaveBeenCalled();
  });

  it('opens a different project while one is already open', async () => {
    const fake = fakeWorker();
    fake.setEntries(await archiveEntries());
    const held = 'project-0000000000000000000000000000000f';

    const result = await openNativeProject(
      sqliteBytes(),
      fake.factory,
      'house.arq',
      undefined,
      held,
    );

    // A different working copy is a real open. The already-open answer must not
    // become a way for any second open to be quietly skipped.
    expect(result.status).toBe('opened');
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

    const result = await openNativeProject(
      sqliteBytes(),
      fake.factory,
      'house.arq',
      undefined,
      null,
      grantsWriterLock,
    );

    expect(result).toMatchObject({ status: 'rejected', code });
    expect(fake.terminate).toHaveBeenCalledOnce();
    expect(fake.dispose).toHaveBeenCalledOnce();
  });

  it('releases the Worker when the archive has no usable model', async () => {
    const fake = fakeWorker();
    fake.setEntries([]);

    const result = await openNativeProject(
      sqliteBytes(),
      fake.factory,
      'house.arq',
      undefined,
      null,
      grantsWriterLock,
    );

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

    const result = await openNativeProject(
      sqliteBytes(),
      fake.factory,
      'house.arq',
      undefined,
      null,
      grantsWriterLock,
    );

    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.snapshot.readOnly).toBe(true);
      expect(result.snapshot.warnings[0]).toMatch(/migration/i);
    }
  });
  /**
   * V3-038. The file records what its own entries should hash to, in
   * `checksums.json`. Until open read it, publication was the only thing that
   * ever did - so a file this build wrote was verified and a file from anywhere
   * else was not.
   */
  describe('entry digest verification', () => {
    async function tamperedWith(path: string, bytes: Uint8Array) {
      const entries = await archiveEntries([
        { id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 } },
      ]);
      return entries.map((entry) => (entry[0] === path ? ([path, bytes] as const) : entry));
    }

    it('refuses a project whose model.json no longer matches its recorded digest', async () => {
      const fake = fakeWorker();
      // Structurally valid JSON, so nothing downstream would have objected: it
      // would have decoded and been adopted as the project.
      fake.setEntries(
        await tamperedWith(
          'model.json',
          new TextEncoder().encode('{"projectName":"Not the project","walls":[]}'),
        ),
      );

      const result = await openNativeProject(
        sqliteBytes(),
        fake.factory,
        'house.arq',
        undefined,
        null,
        grantsWriterLock,
      );

      expect(result).toMatchObject({ status: 'rejected', code: 'ARQ_ENTRY_DIGEST_MISMATCH' });
      if (result.status === 'rejected') {
        expect(result.reason).toContain('model.json');
      }
      // Refused before the archive is parsed, and the Worker is released.
      expect(fake.terminate).toHaveBeenCalled();
    });

    it('refuses a project whose manifest.json was altered', async () => {
      const fake = fakeWorker();
      fake.setEntries(
        await tamperedWith(
          'manifest.json',
          new TextEncoder().encode(
            '{"schemaVersion":0,"applicationVersion":"test","projectId":"00000000-0000-4000-8000-999999999999","createdAt":"2026-08-04T00:00:00.000Z"}',
          ),
        ),
      );

      const result = await openNativeProject(
        sqliteBytes(),
        fake.factory,
        'house.arq',
        undefined,
        null,
        grantsWriterLock,
      );

      expect(result).toMatchObject({ status: 'rejected', code: 'ARQ_ENTRY_DIGEST_MISMATCH' });
    });

    it('opens a project whose thumbnail is corrupt - derived entries are regenerable', async () => {
      const fake = fakeWorker();
      const entries = await archiveEntries([
        { id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 } },
      ]);
      // A derived entry that checksums.json does not describe is not a
      // mismatch at all; one it does describe and that fails is reported and
      // not fatal. Either way the project's meaning is intact.
      fake.setEntries([...entries, ['thumbnails/plan.png', new Uint8Array([1, 2, 3])]]);

      const result = await openNativeProject(
        sqliteBytes(),
        fake.factory,
        'house.arq',
        undefined,
        null,
        grantsWriterLock,
      );

      expect(result.status).toBe('opened');
    });

    it('opens a project carrying no checksums.json - an absent check is not a detected fault', async () => {
      const fake = fakeWorker();
      const entries = await archiveEntries();
      fake.setEntries(entries.filter((entry) => entry[0] !== 'checksums.json'));

      const result = await openNativeProject(
        sqliteBytes(),
        fake.factory,
        'house.arq',
        undefined,
        null,
        grantsWriterLock,
      );

      expect(result.status).toBe('opened');
    });
  });

  /**
   * V3-039. Computed at open rather than verified: nothing on disk records an
   * expected value. It exists so @arq/derived-cache's freshness rule has a
   * "current" hash to compare its stored one against.
   */
  describe('semantic hash', () => {
    it('reports a semantic hash on the snapshot', async () => {
      const fake = fakeWorker();
      fake.setEntries(await archiveEntries());

      const result = await openNativeProject(
        sqliteBytes(),
        fake.factory,
        'house.arq',
        undefined,
        null,
        grantsWriterLock,
      );

      expect(result.status).toBe('opened');
      if (result.status === 'opened') {
        expect(result.snapshot.semanticHash).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('reports a different hash for a project with different contents', async () => {
      const one = fakeWorker();
      one.setEntries(await archiveEntries());
      const two = fakeWorker();
      two.setEntries(
        await archiveEntries([{ id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 } }]),
      );

      const a = await openNativeProject(
        sqliteBytes(),
        one.factory,
        'house.arq',
        undefined,
        null,
        grantsWriterLock,
      );
      const b = await openNativeProject(
        sqliteBytes(),
        two.factory,
        'house.arq',
        undefined,
        null,
        grantsWriterLock,
      );

      expect(a.status === 'opened' && b.status === 'opened').toBe(true);
      if (a.status === 'opened' && b.status === 'opened') {
        expect(a.snapshot.semanticHash).not.toBe(b.snapshot.semanticHash);
      }
    });
  });
  /**
   * V3-030. ADR-0024's single-writer rule. `acquireSingleWriterLock` existed,
   * was tested, and had no caller: `readOnly` came only from the file's
   * writer-version floor, so two windows could open one project writable and
   * each believe it was the writer.
   */
  describe('writer lock', () => {
    it('opens read-only when another window already holds the writer lock', async () => {
      const fake = fakeWorker();
      fake.setEntries(await archiveEntries());

      const result = await openNativeProject(
        sqliteBytes(),
        fake.factory,
        'house.arq',
        undefined,
        null,
        refusesWriterLock(),
      );

      expect(result.status).toBe('opened');
      if (result.status === 'opened') {
        expect(result.snapshot.readOnly).toBe(true);
        // The file itself is perfectly writable - the warning must say which of
        // the two causes this is, or it reads as the file being at fault.
        expect(result.snapshot.warnings.join(' ')).toMatch(/another/i);
      }
    });

    it('reports the lock as the read-only cause, not the file version', async () => {
      const fake = fakeWorker();
      fake.setEntries(await archiveEntries());
      const reasons: (string | null)[] = [];

      await openNativeProject(
        sqliteBytes(),
        fake.factory,
        'house.arq',
        {
          onStaged: () => {},
          onWorkerOpened: (writable, lockReason) => {
            reasons.push(writable ? null : lockReason);
          },
          onHydrateStart: () => {},
        },
        null,
        refusesWriterLock(),
      );

      expect(reasons).toEqual(['another-window-is-editing']);
    });

    it('takes the lock before constructing a Worker, so a contended project is never imported', async () => {
      const fake = fakeWorker();
      fake.setEntries(await archiveEntries());
      const order: string[] = [];

      await openNativeProject(
        sqliteBytes(),
        () => {
          order.push('worker');
          return fake.factory();
        },
        'house.arq',
        undefined,
        null,
        () => {
          order.push('lock');
          return grantsWriterLock();
        },
      );

      expect(order).toEqual(['lock', 'worker']);
    });

    it('releases the lease when the open fails, rather than holding it for a project it never opened', async () => {
      releaseWriterLease.mockClear();
      const fake = fakeWorker({
        readAllArchiveEntries: () => Promise.reject(new Error('worker died')),
      });

      const result = await openNativeProject(
        sqliteBytes(),
        fake.factory,
        'house.arq',
        undefined,
        null,
        grantsWriterLock,
      );

      expect(result.status).toBe('rejected');
      expect(releaseWriterLease).toHaveBeenCalled();
    });

    it('keeps the lease held on a successful open, and releases it when the session closes', async () => {
      releaseWriterLease.mockClear();
      const fake = fakeWorker();
      fake.setEntries(await archiveEntries());

      const result = await openNativeProject(
        sqliteBytes(),
        fake.factory,
        'house.arq',
        undefined,
        null,
        grantsWriterLock,
      );

      expect(result.status).toBe('opened');
      // Held: a lease released as soon as the open finished would guarantee
      // nothing for the lifetime that matters.
      expect(releaseWriterLease).not.toHaveBeenCalled();

      if (result.status === 'opened') {
        await result.session.close();
        expect(releaseWriterLease).toHaveBeenCalled();
      }
    });
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

import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createManifest, exportArchive } from '@arq/project-format';
import { worldPoint } from '@arq/geometry-2d';
import { createNodeArqfsDriver } from '@arq/arqfs/src/arqfs-node-driver';
import {
  createArqfsWorkerSession,
  handleArqfsWorkerRequest,
  type ArqfsWorkerContext,
} from '@arq/arqfs/src/arqfs-worker-handler';
import type { ArqfsDriver } from '@arq/arqfs/src/arqfs-driver';
import type { ArqfsWorkerRequestInput } from '@arq/arqfs/src/arqfs-worker-client';
import { openNativeProject, type NativeWorkerFactory } from './open-native-project';
import { publishNativeProject } from './publish-native-project';
import type { NativeProjectSession } from './native-project-session';

const PROJECT_ID = '00000000-0000-4000-8000-000000000002';
const OTHER_PROJECT_ID = '00000000-0000-4000-8000-000000000099';

type FactoryClient = ReturnType<NativeWorkerFactory>['client'];

/**
 * A `NativeWorkerFactory` backed by the real `handleArqfsWorkerRequest` over real
 * file-backed SQLite databases, one per working-copy id - the same technique
 * `arqfs-worker-handler.test.ts` uses for `importDatabase`/`exportDatabase`, so
 * publication is proven against the real request handler rather than a
 * hand-rolled mock of its responses. Every context this factory constructs is
 * tracked, so a test can assert on the exact number of Workers publication
 * actually used and that each was released.
 *
 * `options.failRequestType` fails exactly the first request of the given type
 * with the given error, then behaves normally - the one hook this test file
 * needs to drive a genuine Worker-reported failure rather than asserting one
 * by constructing a session in an already-failed state.
 */
function createRealWorkerFactory(
  dir: string,
  options: { readonly failRequestType?: string; readonly failError?: string } = {},
): {
  readonly factory: NativeWorkerFactory;
  readonly terminated: Set<string>;
  readonly constructedCount: () => number;
} {
  const terminated = new Set<string>();
  let constructed = 0;
  let failuresRemaining = options.failRequestType === undefined ? 0 : 1;

  const factory: NativeWorkerFactory = (workingCopyId) => {
    constructed += 1;
    const file = path.join(dir, `${workingCopyId}.sqlite3`);
    let driver: ArqfsDriver = createNodeArqfsDriver(file);
    let nextId = 1;
    const context: ArqfsWorkerContext = {
      get driver() {
        return driver;
      },
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
      importDatabase: async (bytes) => {
        driver.close();
        writeFileSync(file, bytes);
        driver = createNodeArqfsDriver(file);
      },
      exportDatabase: () => Promise.resolve(new Uint8Array(readFileSync(file))),
    };

    const client: FactoryClient = {
      request: async (input: ArqfsWorkerRequestInput) => {
        if (input.type === options.failRequestType && failuresRemaining > 0) {
          failuresRemaining -= 1;
          throw new Error(options.failError ?? 'injected test failure');
        }
        const response = await handleArqfsWorkerRequest(context, {
          ...input,
          id: nextId++,
        } as Parameters<typeof handleArqfsWorkerRequest>[1]);
        if (!response.ok) throw new Error(`${response.code}: ${response.error}`);
        return response.payload;
      },
      dispose: () => undefined,
    } as unknown as FactoryClient;

    return {
      worker: {
        terminate: () => {
          terminated.add(workingCopyId);
          try {
            driver.close();
          } catch {
            // Already closed by a prior `close` request.
          }
        },
      } as unknown as Worker,
      client,
    };
  };

  return { factory, terminated, constructedCount: () => constructed };
}

/** A real, openable Arq source file with the given identity - what `openNativeProject` needs to construct a session under test. */
async function projectBytes(
  dir: string,
  fileName: string,
  options: {
    readonly projectId?: string;
    readonly displayName?: string;
    readonly readOnly?: boolean;
  } = {},
): Promise<Uint8Array> {
  const file = path.join(dir, fileName);
  const driver = createNodeArqfsDriver(file);
  const context: ArqfsWorkerContext = {
    driver,
    usedVfs: 'test-node-driver',
    session: createArqfsWorkerSession(),
  };
  await handleArqfsWorkerRequest(context, { id: 1, type: 'open' });
  const entries = await exportArchive({
    manifest: createManifest({
      projectId: options.projectId ?? PROJECT_ID,
      applicationVersion: 'test',
      createdAt: '2026-08-04T00:00:00.000Z',
    }),
    model: { projectName: options.displayName ?? 'Publication test project', walls: [] },
    operations: [],
  });
  await handleArqfsWorkerRequest(context, {
    id: 2,
    type: 'putArchiveEntries',
    entries: [...entries],
  });
  if (options.readOnly === true) {
    driver.exec(`UPDATE arqfs_meta SET value = '99' WHERE key = 'min_writer_major'`);
  }
  driver.close();
  return new Uint8Array(readFileSync(file));
}

describe('publishNativeProject', () => {
  let dir: string;
  let realFactory: ReturnType<typeof createRealWorkerFactory>;
  let session: NativeProjectSession;

  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'arq-publish-'));
    realFactory = createRealWorkerFactory(dir);
    const bytes = await projectBytes(dir, 'source.arq');
    const opened = await openNativeProject(bytes, realFactory.factory, 'house.arq');
    if (opened.status !== 'opened') {
      throw new Error(`test setup failed to open the source project: ${opened.reason}`);
    }
    session = opened.session;
  });

  afterEach(async () => {
    await session.close().catch(() => undefined);
    rmSync(dir, { recursive: true, force: true });
  });

  it('publishes a real project, verified by a fresh reader that agrees with the source', async () => {
    const result = await publishNativeProject(session, realFactory.factory);

    expect(result.status).toBe('published');
    if (result.status !== 'published') throw new Error(`expected published, got ${result.status}`);
    expect(result.receipt.projectId).toBe(PROJECT_ID);
    expect(result.receipt.revision).toBe(0);
    expect(result.receipt.semanticHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.receipt.byteLength).toBeGreaterThan(0);
    expect(new Date(result.receipt.publishedAtIso).toString()).not.toBe('Invalid Date');
    // The fresh reader's own scratch working copy, content-addressed from the
    // published bytes - not asserted to differ from the source's, because at
    // revision 0 the checkpointed export is byte-identical to what was
    // originally imported, and content-addressing correctly gives the two the
    // same id in that case. The edited-project test below covers the case
    // where the ids do diverge.
    expect(result.receipt.workingCopyId).toMatch(/^project-[0-9a-f]+$/);
  });

  it('exercises two Workers - the source and the fresh reader - and releases the fresh one', async () => {
    const before = realFactory.constructedCount();

    await publishNativeProject(session, realFactory.factory);

    // Exactly one more than whatever existed before this call: the fresh
    // reader's verification Worker. The source session's own Worker was
    // already constructed during `beforeEach` and is not reconstructed.
    expect(realFactory.constructedCount()).toBe(before + 1);
    // The fresh reader is scaffolding, not a project the caller opened -
    // released regardless of the outcome, so it cannot hold a working copy's
    // write lock past this call.
    expect(realFactory.terminated.size).toBeGreaterThan(0);
    expect(session.hasUnsavedFailure).toBe(false);
  });

  it('leaves the source project open and unaffected after a successful publish', async () => {
    await publishNativeProject(session, realFactory.factory);

    // Still the same session, still open, still able to answer for itself -
    // publication is a side effect, not a replacement.
    expect(session.snapshot().projectId).toBe(PROJECT_ID);
    const hash = await session.computeSemanticHash();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('publishes a new revision after an edit, and the receipt reflects it', async () => {
    const walls = [{ id: 'w1', start: worldPoint(0, 0), end: worldPoint(3000, 0) }];
    await session.save({ walls, operation: { kind: 'add-walls', walls } });

    const result = await publishNativeProject(session, realFactory.factory);

    expect(result.status).toBe('published');
    if (result.status === 'published') {
      expect(result.receipt.revision).toBe(1);
      // Here the content genuinely changed, so - unlike the zero-edit case -
      // the fresh reader's content-addressed working copy is guaranteed to
      // differ from the source's own.
      expect(result.receipt.workingCopyId).not.toBe(session.snapshot().workingCopyId);
    }
  });

  it('refuses to publish a closed project', async () => {
    await session.close();

    const result = await publishNativeProject(session, realFactory.factory);

    expect(result).toMatchObject({ status: 'rejected', code: 'ARQ_PUBLISH_CLOSED' });
  });

  it('refuses to publish while the last write is unsaved, and never asks the Worker for anything', async () => {
    // A genuine Worker-reported write failure, not one asserted by
    // construction: the factory fails the very next `putArchiveEntries`.
    const failingFactory = createRealWorkerFactory(dir, {
      failRequestType: 'putArchiveEntries',
      failError: 'simulated write failure',
    });
    const bytes = await projectBytes(dir, 'unsaved-source.arq');
    const opened = await openNativeProject(bytes, failingFactory.factory, 'house.arq');
    if (opened.status !== 'opened') throw new Error('expected the source to open');
    const failedWalls = [{ id: 'w1', start: worldPoint(0, 0), end: worldPoint(1, 0) }];
    await opened.session
      .save({ walls: failedWalls, operation: { kind: 'add-walls', walls: failedWalls } })
      .catch(() => undefined);
    expect(opened.session.hasUnsavedFailure).toBe(true);

    const before = failingFactory.constructedCount();
    const result = await publishNativeProject(opened.session, failingFactory.factory);

    expect(result).toMatchObject({ status: 'rejected', code: 'ARQ_PUBLISH_UNSAVED_FAILURE' });
    // Refused before any fresh reader was constructed - an unsaved failure is
    // known from the session's own state, and does not need a Worker round
    // trip to detect.
    expect(failingFactory.constructedCount()).toBe(before);
    await opened.session.close().catch(() => undefined);
  });

  it('reports an interrupted checkpoint/export without ever constructing a fresh reader', async () => {
    const failingFactory = createRealWorkerFactory(dir, {
      failRequestType: 'exportDatabase',
      failError: 'simulated checkpoint/export interruption',
    });
    const bytes = await projectBytes(dir, 'export-interrupt-source.arq');
    const opened = await openNativeProject(bytes, failingFactory.factory, 'house.arq');
    if (opened.status !== 'opened') throw new Error('expected the source to open');

    const before = failingFactory.constructedCount();
    const result = await publishNativeProject(opened.session, failingFactory.factory);

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'ARQ_PUBLISH_EXPORT_FAILED',
      reason: 'simulated checkpoint/export interruption',
    });
    // The interruption is on the source side, before there is anything to
    // verify - no fresh reader was ever constructed to reopen bytes that were
    // never produced.
    expect(failingFactory.constructedCount()).toBe(before);
    await opened.session.close().catch(() => undefined);
  });

  it('refuses to publish a read-only project', async () => {
    const readOnlyBytes = await projectBytes(dir, 'read-only-source.arq', { readOnly: true });
    const factory = createRealWorkerFactory(dir);
    const opened = await openNativeProject(readOnlyBytes, factory.factory, 'read-only.arq');
    if (opened.status !== 'opened') throw new Error('expected the read-only source to open');
    expect(opened.snapshot.readOnly).toBe(true);

    const result = await publishNativeProject(opened.session, factory.factory);

    expect(result).toMatchObject({ status: 'rejected', code: 'ARQ_PUBLISH_READ_ONLY' });
    await opened.session.close();
  });

  /**
   * The comparison this whole verification step exists to run, exercised by
   * substituting a different, independently authored project's bytes for
   * whatever `openNativeProject` tries to import into the fresh reader - the
   * same shape of failure a storage-aliasing or checkpoint bug would produce:
   * the fresh reader opens *something*, cleanly, and it is not what was
   * exported.
   */
  it('reports a mismatch, and still releases the fresh reader, when it disagrees with the source', async () => {
    const otherProjectBytes = await projectBytes(dir, 'other.arq', {
      projectId: OTHER_PROJECT_ID,
      displayName: 'A completely different project',
    });
    const mismatchingFactory: NativeWorkerFactory = (workingCopyId) => {
      const real = realFactory.factory(workingCopyId);
      const client: FactoryClient = {
        request: (input: ArqfsWorkerRequestInput) => {
          if (input.type === 'importDatabase') {
            return real.client.request({ ...input, bytes: otherProjectBytes });
          }
          return real.client.request(input);
        },
        dispose: real.client.dispose,
      } as unknown as FactoryClient;
      return { worker: real.worker, client };
    };

    const result = await publishNativeProject(session, mismatchingFactory);

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.code).toBe('ARQ_PUBLISH_VERIFICATION_MISMATCH');
      // Names the actual disagreement rather than a generic "mismatch".
      expect(result.reason).toContain(OTHER_PROJECT_ID);
      expect(result.reason).toContain(PROJECT_ID);
    }
    // The fresh reader that disagreed is still released, not leaked because it
    // failed verification instead of succeeding.
    expect(realFactory.terminated.size).toBeGreaterThan(0);
  });

  it('reports the underlying reason when the fresh reader cannot reopen the published file at all', async () => {
    // The fresh reader's own Worker refuses to import at all - a storage
    // failure on the verification side, distinct from anything about the
    // exported bytes themselves.
    const brokenFactory: NativeWorkerFactory = (workingCopyId) => {
      const real = realFactory.factory(workingCopyId);
      const client: FactoryClient = {
        request: (input: ArqfsWorkerRequestInput) => {
          if (input.type === 'importDatabase') {
            return Promise.reject(new Error('simulated fresh-reader storage failure'));
          }
          return real.client.request(input);
        },
        dispose: real.client.dispose,
      } as unknown as FactoryClient;
      return { worker: real.worker, client };
    };

    const result = await publishNativeProject(session, brokenFactory);

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.code).toBe('ARQ_PUBLISH_VERIFICATION_FAILED');
      expect(result.reason).toContain('did not reopen cleanly');
      expect(result.reason).toContain('simulated fresh-reader storage failure');
    }
  });

  it('serializes publication through the same queue as concurrent saves, so a save issued during publish cannot race the export', async () => {
    const concurrentWalls = [{ id: 'w1', start: worldPoint(0, 0), end: worldPoint(3000, 0) }];
    const savePromise = session.save({
      walls: concurrentWalls,
      operation: { kind: 'add-walls', walls: concurrentWalls },
    });
    const publishPromise = publishNativeProject(session, realFactory.factory);

    const [, publishResult] = await Promise.all([savePromise, publishPromise]);

    // Whichever queue position it landed in, the publish must have completed
    // cleanly - not have raced the save into exporting a half-written file.
    expect(publishResult.status).toBe('published');
    if (publishResult.status === 'published') {
      // The revision is exactly 0 or exactly 1 - never something in between,
      // which would be the signature of an export that ran mid-write.
      expect([0, 1]).toContain(publishResult.receipt.revision);
    }
  });
});

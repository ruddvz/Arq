import { describe, expect, it, vi } from 'vitest';
import { createManifest, importArchive } from '@arq/project-format';
import { worldPoint } from '@arq/geometry-2d';
import {
  NativeProjectSession,
  NativeProjectReadOnlyError,
  NativeProjectUnsupportedEditError,
  type NativeProjectSnapshot,
  type NativeProjectWorkerHandle,
} from './native-project-session';
import type { DrawnWall } from '../canvas/plan-document';

const PROJECT_ID = '00000000-0000-4000-8000-000000000001';

function snapshot(overrides: Partial<NativeProjectSnapshot> = {}): NativeProjectSnapshot {
  return {
    workingCopyId: `project-${PROJECT_ID}`,
    projectId: PROJECT_ID,
    displayName: 'Existing project',
    walls: [],
    document: null,
    journalSequence: 0,
    semanticHash: 'a'.repeat(64),
    readOnly: false,
    usedVfs: 'opfs-sahpool',
    warnings: [],
    ...overrides,
  };
}

function manifest() {
  return createManifest({
    projectId: PROJECT_ID,
    applicationVersion: 'test',
    createdAt: '2026-08-04T00:00:00.000Z',
  });
}

function wall(id: string, endX: number): DrawnWall {
  return { id, start: worldPoint(0, 0), end: worldPoint(endX, 0) };
}

interface WorkerRequest {
  readonly type: string;
  readonly entries?: ReadonlyArray<readonly [string, Uint8Array]>;
}

function sessionWith(
  respond: (request: WorkerRequest) => Promise<unknown>,
  snapshotOverrides: Partial<NativeProjectSnapshot> = {},
) {
  const dispose = vi.fn();
  const terminate = vi.fn();
  const requestTypes: string[] = [];
  const handle: NativeProjectWorkerHandle = {
    client: {
      request: (async (request: WorkerRequest) => {
        requestTypes.push(request.type);
        return respond(request);
      }) as NativeProjectWorkerHandle['client']['request'],
      dispose,
    },
    terminate,
  };
  const session = new NativeProjectSession(
    handle,
    snapshot(snapshotOverrides),
    createManifest({
      projectId: PROJECT_ID,
      applicationVersion: 'test',
      createdAt: '2026-08-04T00:00:00.000Z',
    }),
  );
  return { session, dispose, terminate, requestTypes };
}

describe('NativeProjectSession write semantics', () => {
  /**
   * Rule 1. Applying the change locally and then persisting it leaves memory
   * holding a state no file has, and the next save writes that phantom state as
   * though it were committed.
   */
  it('does not advance canonical state when the Worker write fails', async () => {
    const { session } = sessionWith(async () => {
      throw new Error('simulated durable write failure');
    });

    await expect(session.save({ walls: [wall('w1', 1000)], journalSequence: 1 })).rejects.toThrow(
      'simulated durable write failure',
    );

    expect(session.snapshot()).toMatchObject({
      displayName: 'Existing project',
      walls: [],
      journalSequence: 0,
    });
    expect(session.hasUnsavedFailure).toBe(true);
  });

  /**
   * Rule 2. Chaining the next save onto a rejected tail would make the first
   * failure the last save the project ever attempted.
   */
  it('runs a later save after an earlier one rejected, building on the last committed state', async () => {
    const written: ReadonlyArray<readonly [string, Uint8Array]>[] = [];
    let attempt = 0;
    const { session } = sessionWith(async (request) => {
      if (request.type !== 'putArchiveEntries') throw new Error(`unexpected ${request.type}`);
      attempt += 1;
      if (attempt === 1) throw new Error('simulated durable write failure');
      written.push(request.entries ?? []);
      return { kind: 'putArchiveEntries' };
    });

    await expect(session.save({ walls: [wall('lost', 1000)], journalSequence: 1 })).rejects.toThrow(
      'simulated durable write failure',
    );
    const committed = wall('committed', 2000);
    await expect(
      session.save({
        walls: [committed],
        operation: { kind: 'add-walls', walls: [committed] },
        journalSequence: 2,
      }),
    ).resolves.toBeUndefined();

    expect(session.snapshot()).toMatchObject({ walls: [committed], journalSequence: 2 });
    expect(session.hasUnsavedFailure).toBe(false);

    // The bytes that actually reached the working copy contain the committed
    // wall and no trace of the failed one.
    const archive = await importArchive(new Map(written[0]));
    expect(archive.status).toBe('opened');
    if (archive.status === 'opened') {
      expect(archive.model).toMatchObject({ walls: [{ id: 'committed' }] });
      expect(archive.operations).toEqual([{ kind: 'add-walls', walls: [committed] }]);
    }
  });

  it('serializes concurrent saves so a later model save does not drop an earlier rename', async () => {
    const written: ReadonlyArray<readonly [string, Uint8Array]>[] = [];
    const { session } = sessionWith(async (request) => {
      written.push(request.entries ?? []);
      return { kind: 'putArchiveEntries' };
    });
    const drawn = wall('w1', 3000);

    // Issued together, without awaiting the first: the queue, not the caller,
    // is what keeps them in order.
    await Promise.all([
      session.save({ displayName: 'Renamed project' }),
      session.save({
        walls: [drawn],
        operation: { kind: 'add-walls', walls: [drawn] },
        journalSequence: 1,
      }),
    ]);

    expect(session.snapshot()).toMatchObject({
      displayName: 'Renamed project',
      walls: [drawn],
      journalSequence: 1,
    });
    const archive = await importArchive(new Map(written[1]));
    expect(archive.status).toBe('opened');
    if (archive.status === 'opened') {
      // The second write carries the first write's name, because it was built
      // from committed state rather than from the snapshot captured at call time.
      expect(archive.model).toMatchObject({ projectName: 'Renamed project' });
    }
  });

  it('refuses to save a read-only project without queueing work that could never land', async () => {
    const { session, requestTypes } = sessionWith(async () => ({ kind: 'putArchiveEntries' }), {
      readOnly: true,
    });

    await expect(session.save({ walls: [wall('w1', 1000)] })).rejects.toBeInstanceOf(
      NativeProjectReadOnlyError,
    );
    expect(requestTypes).toEqual([]);
  });
  it('refuses the flat save path for a reference-format project before touching the Worker', async () => {
    const { session, requestTypes } = sessionWith(async () => ({ kind: 'putArchiveEntries' }), {
      document: {} as NativeProjectSnapshot['document'],
    });

    await expect(
      session.save({
        walls: [wall('w1', 1000)],
        operation: { kind: 'add-walls', walls: [wall('w1', 1000)] },
      }),
    ).rejects.toBeInstanceOf(NativeProjectUnsupportedEditError);
    expect(requestTypes).toEqual([]);
  });

  it('replays failed operation history into the next successful full-state save', async () => {
    const written: ReadonlyArray<readonly [string, Uint8Array]>[] = [];
    let attempt = 0;
    const { session } = sessionWith(async (request) => {
      if (request.type !== 'putArchiveEntries') throw new Error(`unexpected ${request.type}`);
      attempt += 1;
      if (attempt === 1) throw new Error('simulated durable write failure');
      written.push(request.entries ?? []);
      return { kind: 'putArchiveEntries' };
    });
    const first = wall('first', 1000);
    const second = wall('second', 2000);
    const firstOperation = { kind: 'add-walls', walls: [first] } as const;
    const secondOperation = { kind: 'add-walls', walls: [second] } as const;

    await expect(session.save({ walls: [first], operation: firstOperation })).rejects.toThrow(
      'simulated durable write failure',
    );
    await expect(
      session.save({ walls: [first, second], operation: secondOperation }),
    ).resolves.toBeUndefined();

    expect(session.snapshot()).toMatchObject({
      walls: [first, second],
      journalSequence: 2,
    });
    expect(session.hasUnsavedFailure).toBe(false);

    const archive = await importArchive(new Map(written[0]));
    expect(archive.status).toBe('opened');
    if (archive.status === 'opened') {
      expect(archive.model).toMatchObject({
        walls: [{ id: 'first' }, { id: 'second' }],
      });
      expect(archive.operations).toEqual([firstOperation, secondOperation]);
    }
  });

  it('lets a later full wall state supersede geometry from a failed change', async () => {
    const written: ReadonlyArray<readonly [string, Uint8Array]>[] = [];
    let attempt = 0;
    const { session } = sessionWith(async (request) => {
      if (request.type !== 'putArchiveEntries') throw new Error(`unexpected ${request.type}`);
      attempt += 1;
      if (attempt === 1) throw new Error('simulated durable write failure');
      written.push(request.entries ?? []);
      return { kind: 'putArchiveEntries' };
    });
    const failedWall = wall('failed', 1000);
    const replacement = wall('replacement', 2500);

    await expect(
      session.save({
        walls: [failedWall],
        operation: { kind: 'add-walls', walls: [failedWall] },
      }),
    ).rejects.toThrow('simulated durable write failure');
    await session.save({
      walls: [replacement],
      operation: { kind: 'remove-walls', wallIds: ['failed'] },
    });

    const archive = await importArchive(new Map(written[0]));
    expect(archive.status).toBe('opened');
    if (archive.status === 'opened') {
      expect(archive.model).toMatchObject({ walls: [{ id: 'replacement' }] });
    }
  });
});

describe('NativeProjectSession shutdown', () => {
  /**
   * Rule 3. Returning early on a failed final save leaks the Worker, and with it
   * the OPFS write lock on the working copy - so the project cannot be reopened
   * in the same session.
   */
  it('attempts Worker shutdown even after the final save failed, and still reports the failure', async () => {
    const { session, dispose, terminate, requestTypes } = sessionWith(async (request) => {
      if (request.type === 'putArchiveEntries') throw new Error('write failed');
      if (request.type === 'close') return { kind: 'close' };
      throw new Error(`unexpected ${request.type}`);
    });

    await expect(session.save({ walls: [wall('w1', 1000)] })).rejects.toThrow('write failed');
    await expect(session.close()).rejects.toThrow('write failed');

    expect(requestTypes).toEqual(['putArchiveEntries', 'close']);
    expect(dispose).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('releases the Worker even when the close request itself fails', async () => {
    const { session, dispose, terminate } = sessionWith(async (request) => {
      if (request.type === 'close') throw new Error('close failed');
      return { kind: 'putArchiveEntries' };
    });

    await expect(session.close()).rejects.toThrow('close failed');
    expect(dispose).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('closes cleanly when every write landed', async () => {
    const { session, dispose, terminate } = sessionWith(async () => ({
      kind: 'putArchiveEntries',
    }));

    await session.save({ walls: [wall('w1', 1000)], journalSequence: 1 });
    await expect(session.close()).resolves.toBeUndefined();
    expect(dispose).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('refuses saves after close rather than writing to a terminated Worker', async () => {
    const { session } = sessionWith(async () => ({ kind: 'putArchiveEntries' }));
    await session.close();

    await expect(session.save({ walls: [wall('w1', 1000)] })).rejects.toThrow('has been closed');
  });
});

/**
 * V3 publish wiring. The lifecycle has carried `publishing`,
 * `publication-verifying` and `published` since it was written, and nothing
 * could reach them: verified publication existed in @arq/arqfs with no route
 * from the browser to it.
 */
describe('NativeProjectSession.publish', () => {
  function publishingHandle(
    response: unknown,
    seen: { type: string; [key: string]: unknown }[] = [],
  ): NativeProjectWorkerHandle {
    return {
      client: {
        request: async (request: { type: string }) => {
          seen.push(request as { type: string });
          if (request.type === 'publish') return response;
          return { kind: 'close' };
        },
        dispose: vi.fn(),
      } as unknown as NativeProjectWorkerHandle['client'],
      terminate: vi.fn(),
    };
  }

  const RECEIPT = {
    projectId: PROJECT_ID,
    revision: 3,
    semanticHash: 'a'.repeat(64),
    semanticHashScheme: 'arq.semantic-hash.v2',
    formatVersion: { major: 1, minor: 0, schema: 2, minReaderMajor: 1, minWriterMajor: 1 },
    entryCount: 4,
    byteLength: 2048,
    targetPath: 'out.arq',
    verifiedBy: 'fresh-reader' as const,
  };

  it('returns the receipt and the bytes when publication is verified', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const session = new NativeProjectSession(
      publishingHandle({
        kind: 'publish',
        result: { status: 'published', receipt: RECEIPT },
        bytes,
      }),
      snapshot(),
      manifest(),
    );

    const result = await session.publish();

    expect(result.status).toBe('published');
    if (result.status === 'published') {
      expect(result.receipt.verifiedBy).toBe('fresh-reader');
      expect(result.bytes).toBe(bytes);
    }
  });

  it('reports a refusal with its reason rather than throwing', async () => {
    const session = new NativeProjectSession(
      publishingHandle({
        kind: 'publish',
        result: {
          status: 'refused',
          reason: 'semantic-mismatch',
          detail: 'the meaning did not survive the write',
          targetWritten: true,
        },
        bytes: null,
      }),
      snapshot(),
      manifest(),
    );

    const result = await session.publish();

    expect(result).toMatchObject({ status: 'refused', reason: 'semantic-mismatch' });
  });

  it('treats a verified publication with no bytes as a refusal, not a success', async () => {
    // A success with no file is the one outcome that must never be described as
    // success: there is nothing to hand the user.
    const session = new NativeProjectSession(
      publishingHandle({
        kind: 'publish',
        result: { status: 'published', receipt: RECEIPT },
        bytes: null,
      }),
      snapshot(),
      manifest(),
    );

    const result = await session.publish();

    expect(result.status).toBe('refused');
  });

  it('refuses to publish a read-only project without troubling the Worker', async () => {
    const seen: { type: string }[] = [];
    const session = new NativeProjectSession(
      publishingHandle({ kind: 'publish' }, seen),
      snapshot({ readOnly: true }),
      manifest(),
    );

    await expect(session.publish()).rejects.toBeInstanceOf(NativeProjectReadOnlyError);
    expect(seen).toEqual([]);
  });

  it('refuses to publish a closed project', async () => {
    const session = new NativeProjectSession(
      publishingHandle({ kind: 'publish' }),
      snapshot(),
      manifest(),
    );
    await session.close();

    await expect(session.publish()).rejects.toThrow(/closed/);
  });

  it('passes an expected revision through, so a shown revision cannot be silently swapped', async () => {
    const seen: { type: string; [key: string]: unknown }[] = [];
    const session = new NativeProjectSession(
      publishingHandle(
        {
          kind: 'publish',
          result: { status: 'published', receipt: RECEIPT },
          bytes: new Uint8Array([1]),
        },
        seen,
      ),
      snapshot(),
      manifest(),
    );

    await session.publish({ expectedRevision: 3 });

    expect(seen.find((request) => request.type === 'publish')).toMatchObject({
      expectedRevision: 3,
    });
  });

  it('queues behind an in-flight save rather than racing it into a refusal', async () => {
    // publishProjectFile refuses outright when the working copy has an unsettled
    // write, so racing a save would turn "wait your turn" into an error the user
    // has to understand and retry.
    const order: string[] = [];
    const handle: NativeProjectWorkerHandle = {
      client: {
        request: async (request: { type: string }) => {
          order.push(request.type);
          if (request.type === 'publish') {
            return {
              kind: 'publish',
              result: { status: 'published', receipt: RECEIPT },
              bytes: new Uint8Array([1]),
            };
          }
          return { kind: 'putArchiveEntries' };
        },
        dispose: vi.fn(),
      } as unknown as NativeProjectWorkerHandle['client'],
      terminate: vi.fn(),
    };
    const session = new NativeProjectSession(handle, snapshot(), manifest());

    const saved = session.save({ displayName: 'Renamed' });
    const published = session.publish();
    await Promise.all([saved, published]);

    expect(order).toEqual(['putArchiveEntries', 'publish']);
  });
});

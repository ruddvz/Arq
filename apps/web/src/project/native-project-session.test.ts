import { describe, expect, it, vi } from 'vitest';
import { createManifest, importArchive } from '@arq/project-format';
import { worldPoint } from '@arq/geometry-2d';
import {
  NativeProjectSession,
  NativeProjectReadOnlyError,
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
    readOnly: false,
    usedVfs: 'opfs-sahpool',
    warnings: [],
    ...overrides,
  };
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

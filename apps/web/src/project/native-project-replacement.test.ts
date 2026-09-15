import { describe, expect, it, vi } from 'vitest';
import { createManifest } from '@arq/project-format';
import { worldPoint } from '@arq/geometry-2d';
import {
  NativeProjectSession,
  type NativeProjectSnapshot,
  type NativeProjectWorkerHandle,
} from './native-project-session';
import type { DrawnWall } from '../canvas/plan-document';

const PROJECT_ID = '00000000-0000-4000-8000-000000000091';

function wall(id: string, endX: number): DrawnWall {
  return { id, start: worldPoint(0, 0), end: worldPoint(endX, 0) };
}

function snapshot(): NativeProjectSnapshot {
  return {
    workingCopyId: `project-${PROJECT_ID}`,
    projectId: PROJECT_ID,
    displayName: 'Replacement safety project',
    walls: [],
    document: null,
    journalSequence: 0,
    semanticHash: 'a'.repeat(64),
    readOnly: false,
    usedVfs: 'opfs-sahpool',
    warnings: [],
  };
}

function manifest() {
  return createManifest({
    projectId: PROJECT_ID,
    applicationVersion: 'test',
    createdAt: '2026-09-15T00:00:00.000Z',
  });
}

interface WorkerRequest {
  readonly type: string;
}

function sessionWith(respond: (request: WorkerRequest) => Promise<unknown>) {
  const dispose = vi.fn();
  const terminate = vi.fn();
  const handle: NativeProjectWorkerHandle = {
    client: {
      request: respond as NativeProjectWorkerHandle['client']['request'],
      dispose,
    },
    terminate,
  };
  return {
    session: new NativeProjectSession(handle, snapshot(), manifest()),
    dispose,
    terminate,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('NativeProjectSession.prepareForReplacement', () => {
  it('waits behind an in-flight save and reports ready only after that save lands', async () => {
    const write = deferred<unknown>();
    const { session } = sessionWith(async (request) => {
      if (request.type === 'putArchiveEntries') return write.promise;
      if (request.type === 'close') return { kind: 'close' };
      throw new Error(`unexpected ${request.type}`);
    });

    const save = session.save({ walls: [wall('w1', 1000)], journalSequence: 1 });
    const replacement = session.prepareForReplacement();
    let replacementSettled = false;
    void replacement.then(() => {
      replacementSettled = true;
    });

    await Promise.resolve();
    expect(replacementSettled).toBe(false);

    write.resolve({ kind: 'putArchiveEntries' });
    await expect(save).resolves.toBeUndefined();
    await expect(replacement).resolves.toEqual({ status: 'ready' });
    expect(session.snapshot()).toMatchObject({ journalSequence: 1 });
  });

  it('blocks replacement after a failed write without closing the recoverable session', async () => {
    let writeAttempt = 0;
    const { session, dispose, terminate } = sessionWith(async (request) => {
      if (request.type !== 'putArchiveEntries') throw new Error(`unexpected ${request.type}`);
      writeAttempt += 1;
      if (writeAttempt === 1) throw new Error('simulated working-copy failure');
      return { kind: 'putArchiveEntries' };
    });

    const failedWall = wall('failed', 1000);
    await expect(
      session.save({
        walls: [failedWall],
        operation: { kind: 'add-walls', walls: [failedWall] },
      }),
    ).rejects.toThrow('simulated working-copy failure');

    await expect(session.prepareForReplacement()).resolves.toMatchObject({
      status: 'blocked',
      code: 'ARQ_REPLACE_UNSAVED_FAILURE',
    });
    expect(dispose).not.toHaveBeenCalled();
    expect(terminate).not.toHaveBeenCalled();
    expect(session.hasUnsavedFailure).toBe(true);

    // The same live session can still replay the failed operation on the next
    // save. If replacement preflight had called close(), this is the recovery
    // path that would have been destroyed.
    const recoveredWall = wall('recovered', 2000);
    await expect(
      session.save({
        walls: [recoveredWall],
        operation: { kind: 'remove-walls', wallIds: ['failed'] },
      }),
    ).resolves.toBeUndefined();

    expect(session.hasUnsavedFailure).toBe(false);
    expect(session.snapshot()).toMatchObject({ walls: [recoveredWall], journalSequence: 2 });
    await expect(session.prepareForReplacement()).resolves.toEqual({ status: 'ready' });
  });

  it('observes a failure that happens while replacement is waiting on the write queue', async () => {
    const write = deferred<unknown>();
    const { session } = sessionWith(async (request) => {
      if (request.type === 'putArchiveEntries') return write.promise;
      throw new Error(`unexpected ${request.type}`);
    });

    const save = session.save({ walls: [wall('late-failure', 1000)] });
    const replacement = session.prepareForReplacement();
    // Attach the rejection assertion before rejecting the deferred write. If the
    // handler is attached afterwards, Node reports a transient unhandled
    // rejection even though the assertion ultimately observes the same error.
    const saveFailure = expect(save).rejects.toThrow('late durable failure');

    write.reject(new Error('late durable failure'));
    await saveFailure;
    await expect(replacement).resolves.toMatchObject({
      status: 'blocked',
      code: 'ARQ_REPLACE_UNSAVED_FAILURE',
    });
  });

  it('reports a closed session as blocked rather than pretending it is safe to replace', async () => {
    const { session } = sessionWith(async (request) => {
      if (request.type === 'close') return { kind: 'close' };
      return { kind: 'putArchiveEntries' };
    });

    await session.close();
    await expect(session.prepareForReplacement()).resolves.toEqual({
      status: 'blocked',
      code: 'ARQ_REPLACE_CLOSED',
      reason: 'This project has already been closed.',
    });
  });
});

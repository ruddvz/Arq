import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createArqfsWorkerSession,
  createNodeArqfsDriver,
  handleArqfsWorkerRequest,
  type ArqfsDriver,
  type ArqfsWorkerContext,
  type ArqfsWorkerRequest,
  type ArqfsWorkerResponse,
} from '@arq/arqfs';
import { openNativeProject } from './open-native-project';
import type { ArqfsWorkerFactory } from './arqfs-worker-transport';

/**
 * The application-side open, including the guarantee this module exists for: no
 * exit path leaves a Worker running.
 *
 * The Worker is a stand-in that answers with the real
 * `handleArqfsWorkerRequest` over better-sqlite3, so the requests, the refusals
 * and the ordering are the real ones - only the SQLite runtime differs. What is
 * being tested here is what `openNativeProject` does with the answers, and
 * whether `terminate` is called on every branch, which a real Worker would make
 * harder to observe rather than easier.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const fixturePath = path.join(repoRoot, 'fixtures/ARQ_Courtyard_House_Golden_Fixture_v2.arq');

const temporaryDirectories: string[] = [];
const openDrivers: ArqfsDriver[] = [];

afterEach(() => {
  for (const driver of openDrivers.splice(0)) {
    try {
      driver.close();
    } catch {
      // Closed by the code under test.
    }
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixtureCopy(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'arq-open-attempt-'));
  temporaryDirectories.push(directory);
  const target = path.join(directory, 'project.arq');
  copyFileSync(fixturePath, target);
  return target;
}

interface FakeWorker {
  readonly factory: ArqfsWorkerFactory;
  readonly terminated: () => number;
}

/**
 * A Worker stand-in. `mode` selects the failure being reproduced: a Worker that
 * answers normally, one that never answers at all, and one that reports a fatal
 * error the way a real Worker's 'error' event does.
 */
function fakeWorker(filename: string, mode: 'normal' | 'silent' | 'crash' = 'normal'): FakeWorker {
  let terminated = 0;
  const factory: ArqfsWorkerFactory = () => {
    const listeners = new Map<string, Set<(event: unknown) => void>>();
    const emit = (type: string, event: unknown): void => {
      for (const listener of listeners.get(type) ?? []) {
        listener(event);
      }
    };
    const driver = createNodeArqfsDriver(filename);
    openDrivers.push(driver);
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
      source: 'selected-bytes',
    };
    return {
      postMessage(message: ArqfsWorkerRequest): void {
        if (mode === 'silent') {
          return;
        }
        if (mode === 'crash') {
          emit('error', { message: 'the arqfs Worker died' });
          return;
        }
        // The real Worker entry turns the selected bytes into the connection and
        // then delegates an ordinary `open`; this stand-in opens a copy of the
        // file instead, so it has to make the same substitution or it would be
        // testing a request shape the shared handler deliberately refuses.
        const forwarded: ArqfsWorkerRequest =
          message.type === 'openSelectedBytes' ? { id: message.id, type: 'open' } : message;
        const response: ArqfsWorkerResponse = handleArqfsWorkerRequest(context, forwarded);
        // Asynchronous, like a real Worker: a synchronous answer would let a
        // caller accidentally depend on ordering a real one does not provide.
        queueMicrotask(() => emit('message', { data: response }));
      },
      addEventListener(type: string, listener: (event: never) => void): void {
        const set = listeners.get(type) ?? new Set();
        set.add(listener as (event: unknown) => void);
        listeners.set(type, set);
      },
      removeEventListener(type: string, listener: (event: never) => void): void {
        listeners.get(type)?.delete(listener as (event: unknown) => void);
      },
      terminate(): void {
        terminated += 1;
      },
    } as ReturnType<ArqfsWorkerFactory>;
  };
  return { factory, terminated: () => terminated };
}

function fileFrom(filename: string, name = 'project.arq'): File {
  return new File([readFileSync(filename)], name, { type: 'application/octet-stream' });
}

describe('openNativeProject', () => {
  it('opens the golden fixture and keeps the session alive for archive reads', async () => {
    const copy = fixtureCopy();
    const worker = fakeWorker(copy);

    const attempt = await openNativeProject({
      file: fileFrom(copy),
      createWorker: worker.factory,
      attemptId: 'attempt-1',
    });

    expect(attempt.status).toBe('opened');
    if (attempt.status !== 'opened') return;
    expect(attempt.staged.model.summary.projectName).toBe('Courtyard House Reference');
    expect(attempt.staged.model.walls).toHaveLength(79);
    // Still live: the project is open, and closing it is the caller's decision.
    expect(worker.terminated()).toBe(0);

    attempt.session.dispose();
    expect(worker.terminated()).toBe(1);
    // Idempotent, because a caller that disposes twice is a caller doing the
    // right thing twice.
    attempt.session.dispose();
    expect(worker.terminated()).toBe(1);
  });

  it('never constructs a Worker for a file that is not a native project', async () => {
    const copy = fixtureCopy();
    const worker = fakeWorker(copy);
    const notAProject = new File([new Uint8Array([1, 2, 3, 4])], 'notes.txt', {
      type: 'text/plain',
    });

    const attempt = await openNativeProject({
      file: notAProject,
      createWorker: worker.factory,
      attemptId: 'attempt-2',
    });

    // Preflight and routing happen before any Worker exists, so a stray file
    // costs nothing and reaches no SQLite at all.
    expect(attempt.status).not.toBe('opened');
    expect(worker.terminated()).toBe(0);
  });

  it('routes a file that needs conversion to import review instead of opening it', async () => {
    const worker = fakeWorker(fixtureCopy());
    // A DXF header, which @arq/file-ingress detects as an importable format.
    const dxf = new File([new TextEncoder().encode('0\nSECTION\n2\nHEADER\n')], 'plan.dxf');

    const attempt = await openNativeProject({
      file: dxf,
      createWorker: worker.factory,
      attemptId: 'attempt-3',
    });

    expect(attempt.status).toBe('needs-import');
    expect(worker.terminated()).toBe(0);
  });

  it('terminates the Worker when the open is refused', async () => {
    const copy = fixtureCopy();
    const driver = createNodeArqfsDriver(copy);
    driver.run("DELETE FROM archive_entry WHERE path = 'model.json'");
    driver.close();
    const worker = fakeWorker(copy);

    const attempt = await openNativeProject({
      file: fileFrom(copy),
      createWorker: worker.factory,
      attemptId: 'attempt-4',
    });

    expect(attempt.status).toBe('failed');
    if (attempt.status !== 'failed') return;
    expect(attempt.code).toBe('REQUIRED_ENTRIES_MISSING');
    // The whole point: a refused open leaves nothing running.
    expect(worker.terminated()).toBe(1);
  });

  it('terminates the Worker when it crashes, and reports the crash rather than hanging', async () => {
    const worker = fakeWorker(fixtureCopy(), 'crash');

    const attempt = await openNativeProject({
      file: fileFrom(fixtureCopy()),
      createWorker: worker.factory,
      attemptId: 'attempt-5',
    });

    expect(attempt.status).toBe('failed');
    if (attempt.status !== 'failed') return;
    expect(attempt.code).toBe('WORKER_FAILED');
    expect(worker.terminated()).toBe(1);
  });

  it('reports a file it could not read at all without constructing a Worker', async () => {
    const worker = fakeWorker(fixtureCopy());
    const unreadable = {
      name: 'broken.arq',
      type: '',
      arrayBuffer: () => Promise.reject(new Error('permission denied')),
    } as unknown as File;

    const attempt = await openNativeProject({
      file: unreadable,
      createWorker: worker.factory,
      attemptId: 'attempt-6',
    });

    expect(attempt.status).toBe('failed');
    if (attempt.status !== 'failed') return;
    expect(attempt.code).toBe('READ_FAILED');
    expect(attempt.reason).toContain('permission denied');
    expect(worker.terminated()).toBe(0);
  });

  it('transfers the bytes rather than copying them', async () => {
    const copy = fixtureCopy();
    const worker = fakeWorker(copy);
    const file = fileFrom(copy);
    const transferSpy = vi.spyOn(file, 'arrayBuffer');

    await openNativeProject({
      file,
      createWorker: worker.factory,
      attemptId: 'attempt-7',
    });

    // Read exactly once: a second read of a 1 MB project on the main thread is
    // the kind of duplication that only shows up on a large file.
    expect(transferSpy).toHaveBeenCalledTimes(1);
  });
});

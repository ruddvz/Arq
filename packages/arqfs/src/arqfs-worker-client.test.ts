import { describe, expect, it, vi } from 'vitest';
import {
  ArqfsWorkerClient,
  ArqfsWorkerRequestError,
  type ArqfsWorkerLike,
} from './arqfs-worker-client';
import type { ArqfsWorkerRequest, ArqfsWorkerResponse } from './arqfs-worker-protocol';

const TEST_PROJECT_ID = 'test-project';

class FakeWorker implements ArqfsWorkerLike {
  private readonly messageListeners = new Set<(event: MessageEvent<ArqfsWorkerResponse>) => void>();
  private readonly errorListeners = new Set<(event: ErrorEvent) => void>();
  private readonly messageErrorListeners = new Set<(event: MessageEvent) => void>();
  lastRequest: ArqfsWorkerRequest | undefined;

  postMessage(message: ArqfsWorkerRequest): void {
    this.lastRequest = message;
  }

  addEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener:
      | ((event: MessageEvent<ArqfsWorkerResponse>) => void)
      | ((event: ErrorEvent) => void)
      | ((event: MessageEvent) => void),
  ): void {
    if (type === 'message')
      this.messageListeners.add(listener as (event: MessageEvent<ArqfsWorkerResponse>) => void);
    else if (type === 'error') this.errorListeners.add(listener as (event: ErrorEvent) => void);
    else this.messageErrorListeners.add(listener as (event: MessageEvent) => void);
  }

  removeEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener:
      | ((event: MessageEvent<ArqfsWorkerResponse>) => void)
      | ((event: ErrorEvent) => void)
      | ((event: MessageEvent) => void),
  ): void {
    if (type === 'message')
      this.messageListeners.delete(listener as (event: MessageEvent<ArqfsWorkerResponse>) => void);
    else if (type === 'error') this.errorListeners.delete(listener as (event: ErrorEvent) => void);
    else this.messageErrorListeners.delete(listener as (event: MessageEvent) => void);
  }

  respond(response: ArqfsWorkerResponse): void {
    for (const listener of this.messageListeners)
      listener({ data: response } as MessageEvent<ArqfsWorkerResponse>);
  }

  crashWithError(message: string): void {
    for (const listener of this.errorListeners) listener({ message } as ErrorEvent);
  }

  crashWithMessageError(): void {
    for (const listener of this.messageErrorListeners) listener({ data: null } as MessageEvent);
  }
}

describe('ArqfsWorkerClient', () => {
  it('correlates a response and ignores a late response after cancellation', async () => {
    const worker = new FakeWorker();
    const client = new ArqfsWorkerClient(worker);
    const controller = new AbortController();
    const request = client.request(
      { type: 'listArchiveEntryPaths' },
      { signal: controller.signal },
    );
    const requestId = worker.lastRequest?.id;
    expect(requestId).toBeTypeOf('number');
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    worker.respond({
      id: requestId as number,
      projectId: TEST_PROJECT_ID,
      ok: true,
      payload: { kind: 'listArchiveEntryPaths', paths: ['late'] },
    });
    client.dispose();
  });

  it('rejects a timed-out request with its correlation id', async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const client = new ArqfsWorkerClient(worker);
      const request = client.request({ type: 'close' }, { timeoutMs: 10 });
      const requestId = worker.lastRequest?.id as number;
      vi.advanceTimersByTime(10);
      await expect(request).rejects.toEqual(
        new ArqfsWorkerRequestError(requestId, 'arqfs Worker request timed out'),
      );
      client.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects all pending requests when disposed', async () => {
    const worker = new FakeWorker();
    const client = new ArqfsWorkerClient(worker);
    const request = client.request({ type: 'open' });
    client.dispose('test shutdown');
    await expect(request).rejects.toMatchObject({ message: 'test shutdown' });
  });

  it('rejects every pending request when the Worker fires an error event, and notifies onCrash', async () => {
    const worker = new FakeWorker();
    const crashes: unknown[] = [];
    const client = new ArqfsWorkerClient(worker, { onCrash: (info) => crashes.push(info) });
    const first = client.request({ type: 'listArchiveEntryPaths' });
    const second = client.request({ type: 'listArchiveEntryPaths' });

    worker.crashWithError('boom');

    await expect(first).rejects.toMatchObject({ message: 'boom' });
    await expect(second).rejects.toMatchObject({ message: 'boom' });
    expect(crashes).toEqual([{ kind: 'error', message: 'boom' }]);
  });

  it('rejects every pending request when the Worker fires a messageerror event, since the failing request cannot be identified', async () => {
    const worker = new FakeWorker();
    const client = new ArqfsWorkerClient(worker);
    const request = client.request({ type: 'listArchiveEntryPaths' });

    worker.crashWithMessageError();

    await expect(request).rejects.toMatchObject({
      message: 'arqfs Worker response could not be deserialized',
    });
  });

  it('refuses new requests after a crash instead of queuing them against a dead Worker', async () => {
    const worker = new FakeWorker();
    const client = new ArqfsWorkerClient(worker);
    worker.crashWithError('boom');

    await expect(client.request({ type: 'listArchiveEntryPaths' })).rejects.toThrow(
      /construct a new Worker/,
    );
  });

  /** A response that arrives just after a crash must not resolve a promise already rejected by the crash. */
  it('a message that arrives after a crash does not resolve an already-rejected request', async () => {
    const worker = new FakeWorker();
    const client = new ArqfsWorkerClient(worker);
    const request = client.request({ type: 'listArchiveEntryPaths' });
    const requestId = worker.lastRequest?.id as number;

    worker.crashWithError('boom');
    await expect(request).rejects.toMatchObject({ message: 'boom' });

    // Must not throw and must not resolve the already-settled promise.
    worker.respond({
      id: requestId,
      projectId: TEST_PROJECT_ID,
      ok: true,
      payload: { kind: 'listArchiveEntryPaths', paths: ['late'] },
    });
  });

  it('does not report a second crash once already crashed', () => {
    const worker = new FakeWorker();
    const crashes: unknown[] = [];
    const client = new ArqfsWorkerClient(worker, { onCrash: (info) => crashes.push(info) });

    worker.crashWithError('first');
    worker.crashWithError('second');

    expect(crashes).toHaveLength(1);
  });

  it('dispose after a crash does not throw and does not report a crash', () => {
    const worker = new FakeWorker();
    const crashes: unknown[] = [];
    const client = new ArqfsWorkerClient(worker, { onCrash: (info) => crashes.push(info) });

    worker.crashWithError('boom');
    expect(() => client.dispose()).not.toThrow();
    expect(crashes).toHaveLength(1);
  });
});

describe('project correlation', () => {
  it('fails a request whose response names a different project', async () => {
    const worker = new FakeWorker();
    const client = new ArqfsWorkerClient(worker, { projectId: 'project-a' });

    const request = client.request({ type: 'listArchiveEntryPaths' });
    const requestId = worker.lastRequest?.id as number;
    // The outgoing Worker of a project switch, still alive, answering with an
    // id that happens to match this client's own counter. OPFS is shared at
    // the origin, so this response describes different bytes entirely.
    worker.respond({
      id: requestId,
      projectId: 'project-b',
      ok: true,
      payload: { kind: 'listArchiveEntryPaths', paths: ['someone-elses-project'] },
    });

    await expect(request).rejects.toMatchObject({
      name: 'ArqfsWorkerRequestError',
      message: expect.stringContaining('project-b'),
    });
    client.dispose();
  });

  it('accepts a response from its own declared project', async () => {
    const worker = new FakeWorker();
    const client = new ArqfsWorkerClient(worker, { projectId: 'project-a' });

    const request = client.request({ type: 'listArchiveEntryPaths' });
    worker.respond({
      id: worker.lastRequest?.id as number,
      projectId: 'project-a',
      ok: true,
      payload: { kind: 'listArchiveEntryPaths', paths: ['model.json'] },
    });

    await expect(request).resolves.toEqual({
      kind: 'listArchiveEntryPaths',
      paths: ['model.json'],
    });
    client.dispose();
  });

  it('leaves correlation to the request id alone when no project is declared', async () => {
    const worker = new FakeWorker();
    const client = new ArqfsWorkerClient(worker);

    const request = client.request({ type: 'listArchiveEntryPaths' });
    worker.respond({
      id: worker.lastRequest?.id as number,
      projectId: 'whatever',
      ok: true,
      payload: { kind: 'listArchiveEntryPaths', paths: [] },
    });

    await expect(request).resolves.toMatchObject({ kind: 'listArchiveEntryPaths' });
    client.dispose();
  });

  it('also rejects a mismatched project on a refusal response, not only on success', async () => {
    const worker = new FakeWorker();
    const client = new ArqfsWorkerClient(worker, { projectId: 'project-a' });

    const request = client.request({ type: 'open' });
    worker.respond({
      id: worker.lastRequest?.id as number,
      projectId: 'project-b',
      ok: false,
      code: 'ARQFS_WORKER_NOT_OPENED',
      error: 'not opened',
    });

    // The mismatch is reported, not the refusal's own (real but misattributed) reason.
    await expect(request).rejects.toMatchObject({ message: expect.stringContaining('project-b') });
    client.dispose();
  });
});

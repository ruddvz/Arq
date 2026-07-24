import { describe, expect, it, vi } from 'vitest';
import {
  ArqfsWorkerClient,
  ArqfsWorkerRequestError,
  type ArqfsWorkerLike,
} from './arqfs-worker-client';
import type { ArqfsWorkerRequest, ArqfsWorkerResponse } from './arqfs-worker-protocol';

class FakeWorker implements ArqfsWorkerLike {
  private readonly listeners = new Set<(event: MessageEvent<ArqfsWorkerResponse>) => void>();
  lastRequest: ArqfsWorkerRequest | undefined;

  postMessage(message: ArqfsWorkerRequest): void {
    this.lastRequest = message;
  }

  addEventListener(
    _type: 'message',
    listener: (event: MessageEvent<ArqfsWorkerResponse>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: 'message',
    listener: (event: MessageEvent<ArqfsWorkerResponse>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  respond(response: ArqfsWorkerResponse): void {
    for (const listener of this.listeners)
      listener({ data: response } as MessageEvent<ArqfsWorkerResponse>);
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
});

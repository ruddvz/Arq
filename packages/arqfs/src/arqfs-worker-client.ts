import type {
  ArqfsWorkerRequest,
  ArqfsWorkerResponse,
  ArqfsWorkerResponsePayload,
} from './arqfs-worker-protocol';

export type ArqfsWorkerRequestInput = Omit<ArqfsWorkerRequest, 'id'>;

export interface ArqfsWorkerLike {
  postMessage(message: ArqfsWorkerRequest, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<ArqfsWorkerResponse>) => void,
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent<ArqfsWorkerResponse>) => void,
  ): void;
}

export interface ArqfsWorkerRequestOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  /** Transfer only buffers whose ownership the caller is willing to give to the Worker. */
  readonly transfer?: readonly Transferable[];
}

export class ArqfsWorkerRequestError extends Error {
  readonly requestId: number;

  constructor(requestId: number, message: string) {
    super(message);
    this.name = 'ArqfsWorkerRequestError';
    this.requestId = requestId;
  }
}

interface PendingRequest {
  readonly resolve: (payload: ArqfsWorkerResponsePayload) => void;
  readonly reject: (error: unknown) => void;
  readonly timeout: ReturnType<typeof setTimeout> | undefined;
  readonly abort: (() => void) | undefined;
}

/**
 * Correlates Worker RPC responses, bounds hung requests and drops late results
 * after cancellation. The SQLite Worker remains the only place allowed to touch
 * the database; this client owns transport lifecycle only.
 */
export class ArqfsWorkerClient {
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private disposed = false;

  private readonly onMessage = (event: MessageEvent<ArqfsWorkerResponse>): void => {
    const response = event.data;
    if (response === null || typeof response !== 'object' || typeof response.id !== 'number') {
      return;
    }
    const pending = this.pending.get(response.id);
    if (pending === undefined) {
      return;
    }
    this.pending.delete(response.id);
    if (pending.timeout !== undefined) clearTimeout(pending.timeout);
    pending.abort?.();
    if (response.ok) {
      pending.resolve(response.payload);
    } else {
      pending.reject(new ArqfsWorkerRequestError(response.id, response.error));
    }
  };

  constructor(private readonly worker: ArqfsWorkerLike) {
    worker.addEventListener('message', this.onMessage);
  }

  request(
    request: ArqfsWorkerRequestInput,
    options: ArqfsWorkerRequestOptions = {},
  ): Promise<ArqfsWorkerResponsePayload> {
    if (this.disposed) {
      return Promise.reject(new Error('arqfs Worker client is disposed'));
    }
    const requestId = this.nextRequestId++;
    const message = { ...request, id: requestId } as ArqfsWorkerRequest;
    const timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
      return Promise.reject(new RangeError('Worker request timeout must be a positive integer'));
    }
    if (options.signal?.aborted) {
      return Promise.reject(new DOMException('The request was aborted.', 'AbortError'));
    }

    return new Promise<ArqfsWorkerResponsePayload>((resolve, reject) => {
      let abort: (() => void) | undefined;
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        abort?.();
        reject(new ArqfsWorkerRequestError(requestId, 'arqfs Worker request timed out'));
      }, timeoutMs);
      if (options.signal !== undefined) {
        abort = () => options.signal?.removeEventListener('abort', onAbort);
        const onAbort = (): void => {
          this.pending.delete(requestId);
          clearTimeout(timeout);
          reject(new DOMException('The request was aborted.', 'AbortError'));
          abort?.();
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
      this.pending.set(requestId, { resolve, reject, timeout, abort });
      try {
        this.worker.postMessage(
          message,
          options.transfer === undefined ? undefined : [...options.transfer],
        );
      } catch (error) {
        this.pending.delete(requestId);
        clearTimeout(timeout);
        abort?.();
        reject(error);
      }
    });
  }

  dispose(reason = 'arqfs Worker client disposed'): void {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.removeEventListener('message', this.onMessage);
    for (const [requestId, pending] of this.pending) {
      if (pending.timeout !== undefined) clearTimeout(pending.timeout);
      pending.abort?.();
      pending.reject(new ArqfsWorkerRequestError(requestId, reason));
    }
    this.pending.clear();
  }
}

import type {
  ArqfsWorkerRequest,
  ArqfsWorkerResponse,
  ArqfsWorkerResponsePayload,
} from './arqfs-worker-protocol';

/**
 * Distributes over the request union before removing `id`.
 *
 * A plain `Omit<ArqfsWorkerRequest, 'id'>` is not the same type: `keyof` a union
 * is only the keys *common* to every member, so it collapses to `{ type: ... }`
 * and silently discards `path` and `entries`. That made every parameterized
 * request untypeable - a caller could ask to write archive entries, but not say
 * which - so the only requests this client could actually express were the
 * argument-free ones.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type ArqfsWorkerRequestInput = DistributiveOmit<ArqfsWorkerRequest, 'id'>;

export interface ArqfsWorkerLike {
  postMessage(message: ArqfsWorkerRequest, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<ArqfsWorkerResponse>) => void,
  ): void;
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
  addEventListener(type: 'messageerror', listener: (event: MessageEvent) => void): void;
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent<ArqfsWorkerResponse>) => void,
  ): void;
  removeEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
  removeEventListener(type: 'messageerror', listener: (event: MessageEvent) => void): void;
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

export interface ArqfsWorkerCrashInfo {
  readonly kind: 'error' | 'messageerror';
  readonly message: string;
}

export interface ArqfsWorkerClientOptions {
  /**
   * The project this client's Worker was constructed for. When set, a
   * response naming a different project fails its request with a protocol
   * error instead of being accepted as the answer.
   *
   * Request ids are unique within one client, not across the origin, and
   * OPFS storage is shared at the origin - so during a project switch, with
   * the outgoing Worker still alive, id correlation alone cannot tell whose
   * answer arrived. Failing loudly rather than ignoring the message is
   * deliberate: a silently dropped response leaves the request to time out
   * thirty seconds later with no indication of what actually happened.
   */
  readonly projectId?: string;
  /**
   * Called once, the first time the underlying Worker fires 'error' or
   * 'messageerror'. Every pending request has already been rejected by the time
   * this runs, and every request on this client rejects from here on - this
   * client's job is bounding the damage of a crash, not surviving it. Recovery is
   * the owner's decision: construct a fresh Worker and a fresh client.
   */
  readonly onCrash?: (info: ArqfsWorkerCrashInfo) => void;
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
  private crashedState = false;

  get crashed(): boolean {
    return this.crashedState;
  }

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
    const expectedProjectId = this.options.projectId;
    if (expectedProjectId !== undefined && response.projectId !== expectedProjectId) {
      pending.reject(
        new ArqfsWorkerRequestError(
          response.id,
          `arqfs Worker response is for project "${response.projectId}", not "${expectedProjectId}"`,
        ),
      );
      return;
    }
    if (response.ok) {
      pending.resolve(response.payload);
    } else {
      pending.reject(new ArqfsWorkerRequestError(response.id, response.error));
    }
  };

  private readonly onWorkerError = (event: ErrorEvent): void => {
    this.handleCrash(
      'error',
      event.message.length > 0 ? event.message : 'arqfs Worker reported an error',
    );
  };

  private readonly onWorkerMessageError = (): void => {
    // messageerror carries no usable detail - a MessageEvent whose data typically
    // failed to deserialize - and no way to identify which in-flight request
    // produced it, so every pending request is rejected rather than left to time out.
    this.handleCrash('messageerror', 'arqfs Worker response could not be deserialized');
  };

  private handleCrash(kind: 'error' | 'messageerror', message: string): void {
    if (this.crashedState || this.disposed) return;
    this.crashedState = true;
    this.rejectAllPending((requestId) => new ArqfsWorkerRequestError(requestId, message));
    this.options.onCrash?.({ kind, message });
  }

  private rejectAllPending(makeError: (requestId: number) => unknown): void {
    for (const [requestId, pending] of this.pending) {
      if (pending.timeout !== undefined) clearTimeout(pending.timeout);
      pending.abort?.();
      pending.reject(makeError(requestId));
    }
    this.pending.clear();
  }

  constructor(
    private readonly worker: ArqfsWorkerLike,
    private readonly options: ArqfsWorkerClientOptions = {},
  ) {
    worker.addEventListener('message', this.onMessage);
    worker.addEventListener('error', this.onWorkerError);
    worker.addEventListener('messageerror', this.onWorkerMessageError);
  }

  request(
    request: ArqfsWorkerRequestInput,
    options: ArqfsWorkerRequestOptions = {},
  ): Promise<ArqfsWorkerResponsePayload> {
    if (this.disposed) {
      return Promise.reject(new Error('arqfs Worker client is disposed'));
    }
    if (this.crashedState) {
      return Promise.reject(new Error('arqfs Worker crashed; construct a new Worker and client'));
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
    this.worker.removeEventListener('error', this.onWorkerError);
    this.worker.removeEventListener('messageerror', this.onWorkerMessageError);
    this.rejectAllPending((requestId) => new ArqfsWorkerRequestError(requestId, reason));
  }
}

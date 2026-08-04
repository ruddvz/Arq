import {
  ArqfsWorkerClient,
  type ArqfsWorkerLike,
  type ArqfsWorkerRequestInput,
} from '@arq/arqfs/src/arqfs-worker-client';
import type { ArqfsWorkerResponsePayload } from '@arq/arqfs/src/arqfs-worker-protocol';
import type { NativeOpenTransport } from '@arq/project-loading';

/**
 * The main-thread half of a read-only native open: it owns the Worker's
 * lifetime and nothing else.
 *
 * `@arq/project-loading`'s pipeline decides the order of an open, `@arq/arqfs`'s
 * handler decides what each request is allowed to do, and `ArqfsWorkerClient`
 * correlates the messages. This module exists only to bind those to a real
 * `Worker` and to guarantee the Worker is terminated on every exit path -
 * including the ones nobody plans for, which is why `dispose` is idempotent and
 * why the caller gets it as part of the object rather than having to remember a
 * separate handle.
 *
 * Deep imports rather than the `@arq/arqfs` barrel: the barrel re-exports the
 * better-sqlite3 driver, which cannot be bundled for a browser.
 */
export interface ArqfsSelectedBytesSession {
  readonly transport: NativeOpenTransport;
  /** Terminates the Worker and releases its heap. Safe to call more than once. */
  dispose(): void;
  /** True once the Worker has reported an error it cannot continue past. */
  readonly crashed: () => boolean;
}

export interface ArqfsWorkerFactory {
  /** Constructs a Worker in selected-bytes mode. Injected so tests do not need a real Worker. */
  (): ArqfsWorkerLike & { terminate(): void };
}

/** A request that carries a whole project file gets longer than the default. */
const OPEN_TIMEOUT_MS = 120_000;

/**
 * `bytes` is transferred, not copied: its buffer belongs to the Worker from the
 * moment `open()` is called, so the caller must have finished with it. Preflight
 * and format routing run on the main thread before this, which is exactly why
 * they run before this.
 */
export function createArqfsSelectedBytesSession(
  createWorker: ArqfsWorkerFactory,
  bytes: Uint8Array,
): ArqfsSelectedBytesSession {
  const worker = createWorker();
  let disposed = false;
  const client = new ArqfsWorkerClient(worker);

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    // Order matters: rejecting in-flight requests first means a pending open
    // settles with a clear error instead of hanging until its own timeout after
    // the Worker it was waiting on has already gone.
    client.dispose('the project was closed');
    worker.terminate();
  };

  const send = async (
    request: ArqfsWorkerRequestInput,
    options?: { readonly transfer?: readonly Transferable[]; readonly timeoutMs?: number },
  ): Promise<ArqfsWorkerResponsePayload> => {
    if (disposed) {
      throw new Error('this project connection has been closed');
    }
    return await client.request(request, options ?? {});
  };

  const expect = <K extends ArqfsWorkerResponsePayload['kind']>(
    payload: ArqfsWorkerResponsePayload,
    kind: K,
  ): Extract<ArqfsWorkerResponsePayload, { kind: K }> => {
    if (payload.kind !== kind) {
      throw new Error(`arqfs Worker answered a ${kind} request with a ${payload.kind} payload`);
    }
    return payload as Extract<ArqfsWorkerResponsePayload, { kind: K }>;
  };

  const transport: NativeOpenTransport = {
    async open() {
      const payload = expect(
        await send(
          { type: 'openSelectedBytes', bytes },
          { transfer: [bytes.buffer], timeoutMs: OPEN_TIMEOUT_MS },
        ),
        'open',
      );
      return { result: payload.result, usedVfs: payload.usedVfs };
    },
    async recoveryReport() {
      return expect(await send({ type: 'recoveryReport' }), 'recoveryReport').report;
    },
    async workingCopyState() {
      return expect(await send({ type: 'readWorkingCopyState' }), 'readWorkingCopyState').state;
    },
    async listArchiveEntryPaths() {
      return expect(await send({ type: 'listArchiveEntryPaths' }), 'listArchiveEntryPaths').paths;
    },
    async getArchiveEntry(path: string) {
      return expect(await send({ type: 'getArchiveEntry', path }), 'getArchiveEntry').content;
    },
  };

  return { transport, dispose, crashed: () => client.crashed };
}

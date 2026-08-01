import { validateArqfsProjectId } from './arqfs-policy';

/**
 * ARQ-220: enforce one active project writer per ADR-0024 ("Enforce one active
 * project writer through an application lock and BroadcastChannel coordination").
 *
 * Three properties this has to get right, each of which the first version did not:
 *
 * **The lock is per project.** ADR-0024's isolation only holds if the lock name is
 * project-scoped, exactly as the OPFS filename already is
 * (`opfsFilenameForProject`). A single global name meant opening project A in one
 * tab blocked project B in another - the precise opposite of the isolation
 * `run-arqfs-project-isolation-capability-check.mjs` proves at the file level. The
 * name is derived through `validateArqfsProjectId`, so one project cannot be named
 * in a way that forges another's lock.
 *
 * **A refusal is an answer, not a hang.** `navigator.locks.request` can reject -
 * a document that is not fully active, an invalid name, a storage-partitioning
 * refusal - and the first version discarded that rejection with `void` while
 * awaiting a promise that only ever resolved inside the granted callback. The
 * result was an open path that neither opened editable nor degraded: it waited
 * for ever. Every failure path now resolves to a read-only lease with a reason.
 *
 * **Degrading is the default.** The Web Locks API queues rather than failing, so
 * waiting behind another tab is possible but is rarely what a person wants: they
 * would rather see the project read-only, with an explanation, than watch it hang.
 * `waitForRelease: true` restores queueing for callers that genuinely want it.
 *
 * The environment is injected, which is what makes all of this testable in plain
 * Node. The previous version reached for `navigator` and `BroadcastChannel` as
 * globals and its own comment concluded it was "not testable in plain Node" -
 * true only because of that choice.
 */

export const WRITER_LOCK_NAME_PREFIX = 'arqfs-project-writer';
export const WRITER_CHANNEL_NAME_PREFIX = 'arqfs-writer-notifications';

/** The lock this project's writer holds. Scoped so a different project never contends for it. */
export function writerLockNameForProject(projectId: string): string {
  validateArqfsProjectId(projectId);
  return `${WRITER_LOCK_NAME_PREFIX}:${projectId}`;
}

/** The channel this project's writer announces on. Scoped for the same reason. */
export function writerChannelNameForProject(projectId: string): string {
  validateArqfsProjectId(projectId);
  return `${WRITER_CHANNEL_NAME_PREFIX}:${projectId}`;
}

export interface ArqfsWriterLockHandle {
  /** Releases the writer lock and notifies other contexts via the broadcast channel. Idempotent - safe to call more than once. */
  release(): void;
}

export type WriterNotification =
  { readonly type: 'writer-acquired' } | { readonly type: 'writer-released' };

/** Why this context is not the writer. Each maps to different copy, so they are not collapsed into one. */
export type ReadOnlyReason =
  /** Another tab or context holds the writer lock for this project. */
  | 'another-context-is-writing'
  /** This browser or context does not expose the Web Locks API at all. */
  | 'locks-unavailable'
  /** The lock request itself was refused, for example in a document that is not fully active. */
  | 'lock-request-refused';

export type ArqfsWriterLease =
  | { readonly status: 'writer'; readonly handle: ArqfsWriterLockHandle }
  | { readonly status: 'read-only'; readonly reason: ReadOnlyReason };

interface BroadcastChannelLike {
  postMessage(message: WriterNotification): void;
  close(): void;
  onmessage: ((event: { data: WriterNotification }) => void) | null;
}

interface LockManagerLike {
  request(
    name: string,
    options: { mode: 'exclusive'; ifAvailable?: boolean },
    callback: (lock: unknown | null) => Promise<void>,
  ): Promise<unknown>;
}

/** The browser globals this module uses, injected so every branch is reachable from a test. */
export interface WriterLockEnvironment {
  readonly locks: LockManagerLike | undefined;
  createChannel(name: string): BroadcastChannelLike;
}

function browserEnvironment(): WriterLockEnvironment {
  const manager = (globalThis as { navigator?: { locks?: LockManagerLike } }).navigator?.locks;
  return {
    locks: manager,
    createChannel: (name) => new BroadcastChannel(name) as unknown as BroadcastChannelLike,
  };
}

export interface WriterLockOptions {
  readonly projectId: string;
  /** Queue behind whoever holds the lock instead of degrading to read-only. Off by default: a hang is worse than an explanation. */
  readonly waitForRelease?: boolean;
  readonly environment?: WriterLockEnvironment;
}

/**
 * Asks to be this project's writer, and always answers.
 *
 * Resolves to a `writer` lease holding the lock, or a `read-only` lease naming
 * why. It never rejects and never waits indefinitely unless `waitForRelease` was
 * asked for explicitly.
 */
export async function acquireSingleWriterLock(
  options: WriterLockOptions,
): Promise<ArqfsWriterLease> {
  const environment = options.environment ?? browserEnvironment();
  const lockName = writerLockNameForProject(options.projectId);
  const channelName = writerChannelNameForProject(options.projectId);

  const locks = environment.locks;
  if (locks === undefined) {
    return { status: 'read-only', reason: 'locks-unavailable' };
  }

  const channel = environment.createChannel(channelName);
  let released = false;
  let releaseHeldLock: () => void = () => {};

  const lease = await new Promise<ArqfsWriterLease>((resolve) => {
    const settleReadOnly = (reason: ReadOnlyReason): void => {
      channel.close();
      resolve({ status: 'read-only', reason });
    };

    const request = locks.request(
      lockName,
      options.waitForRelease === true
        ? { mode: 'exclusive' }
        : { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        // With `ifAvailable`, the callback runs with `null` when the lock is
        // already held. Returning immediately releases nothing, because nothing
        // was granted.
        if (lock === null) {
          settleReadOnly('another-context-is-writing');
          return;
        }
        channel.postMessage({ type: 'writer-acquired' });
        resolve({
          status: 'writer',
          handle: {
            release(): void {
              if (released) {
                return;
              }
              released = true;
              channel.postMessage({ type: 'writer-released' });
              channel.close();
              releaseHeldLock();
            },
          },
        });
        // Held until `release()` is called. This is the promise the Web Locks
        // API waits on to decide the lock is still in use.
        await new Promise<void>((resolveHeld) => {
          releaseHeldLock = resolveHeld;
        });
      },
    );

    // The rejection the first version discarded. Without this, a refused
    // request left the caller awaiting a promise nothing would ever settle.
    void Promise.resolve(request).catch(() => {
      settleReadOnly('lock-request-refused');
    });
  });

  return lease;
}

/** Subscribes to this project's writer notifications. Returns an unsubscribe function. */
export function onWriterChange(
  callback: (notification: WriterNotification) => void,
  options: { readonly projectId: string; readonly environment?: WriterLockEnvironment },
): () => void {
  const environment = options.environment ?? browserEnvironment();
  const channel = environment.createChannel(writerChannelNameForProject(options.projectId));
  channel.onmessage = (event) => callback(event.data);
  return () => channel.close();
}

/** What the UI says about a read-only lease. Never colour or an icon alone: each reason has a different repair. */
export function describeReadOnlyReason(reason: ReadOnlyReason): string {
  switch (reason) {
    case 'another-context-is-writing':
      return 'This project is open for editing in another tab or window. Close it there to edit here.';
    case 'locks-unavailable':
      return 'This browser cannot coordinate editing between tabs, so the project is open for reading only.';
    case 'lock-request-refused':
      return 'Editing could not be claimed for this project, so it is open for reading only. Reload the page to try again.';
  }
}

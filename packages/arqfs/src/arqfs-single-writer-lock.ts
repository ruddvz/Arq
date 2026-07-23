/**
 * ARQ-220: enforce one active project writer per ADR-0024 ("Enforce one active
 * project writer through an application lock and BroadcastChannel coordination").
 * Browser-only (Web Locks API + BroadcastChannel) - not testable in plain Node/
 * Vitest, verified instead via a real two-page headless-Chromium check
 * (scripts/run-arqfs-writer-lock-capability-check.mjs), matching this repo's
 * "verify against the real thing" discipline for browser-only capability.
 */

export const DEFAULT_WRITER_LOCK_NAME = 'arqfs-project-writer';
export const DEFAULT_WRITER_CHANNEL_NAME = 'arqfs-writer-notifications';

export interface ArqfsWriterLockHandle {
  /** Releases the writer lock and notifies other contexts via the broadcast channel. Idempotent - safe to call more than once. */
  release(): void;
}

export interface WriterLockOptions {
  readonly lockName?: string;
  readonly channelName?: string;
}

export type WriterNotification =
  { readonly type: 'writer-acquired' } | { readonly type: 'writer-released' };

/**
 * Requests exclusive ownership of the single-writer lock, resolving once granted.
 * Waits behind any other tab/context already holding it - the Web Locks API queues
 * requests rather than failing them, so a second caller genuinely blocks here (not
 * throws) until the first releases, matching ADR-0024's "one active project writer"
 * requirement.
 */
export async function acquireSingleWriterLock(
  options: WriterLockOptions = {},
): Promise<ArqfsWriterLockHandle> {
  const lockName = options.lockName ?? DEFAULT_WRITER_LOCK_NAME;
  const channelName = options.channelName ?? DEFAULT_WRITER_CHANNEL_NAME;
  const channel = new BroadcastChannel(channelName);

  let released = false;
  let releaseHeldLock: () => void = () => {};

  const acquiredSignal = new Promise<void>((resolveAcquired) => {
    void navigator.locks.request(lockName, { mode: 'exclusive' }, () => {
      const notification: WriterNotification = { type: 'writer-acquired' };
      channel.postMessage(notification);
      resolveAcquired();
      return new Promise<void>((resolveHeld) => {
        releaseHeldLock = resolveHeld;
      });
    });
  });

  await acquiredSignal;

  return {
    release(): void {
      if (released) {
        return;
      }
      released = true;
      const notification: WriterNotification = { type: 'writer-released' };
      channel.postMessage(notification);
      channel.close();
      releaseHeldLock();
    },
  };
}

/** Subscribes to writer-acquired/writer-released notifications from other tabs/contexts on the same channel. Returns an unsubscribe function. */
export function onWriterChange(
  callback: (notification: WriterNotification) => void,
  options: WriterLockOptions = {},
): () => void {
  const channelName = options.channelName ?? DEFAULT_WRITER_CHANNEL_NAME;
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = (event: MessageEvent<WriterNotification>) => callback(event.data);
  return () => channel.close();
}

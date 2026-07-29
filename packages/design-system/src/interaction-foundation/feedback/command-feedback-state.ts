/**
 * W135 ToastRegion's state half (CMP-029): a bounded, grouping,
 * auto-expiring command-feedback queue, pure and framework-free so it can be
 * tested the way every other design-system state module is.
 *
 * Contract (docs/components/CMP-029-toast.md + the interaction-foundation
 * command-feedback rules):
 * - Success is published only after the semantic operation succeeded; failure
 *   only after it actually failed. Publishing is the CALLER's contract - this
 *   store never converts one into the other and never swallows anything.
 * - Repeated identical messages group into one entry with a count instead of
 *   spamming ("Wall drawn ×3"), and re-publishing refreshes the entry's
 *   expiry.
 * - The queue is hard-capped: the oldest entry is dropped first. A feedback
 *   queue must never grow without bound during repeated tool use.
 * - Expiry is time-based and pausable (hover/focus pauses the clock per
 *   CMP-029); expiry never removes an entry while paused.
 */

export type CommandFeedbackTone = 'success' | 'info' | 'error';

export interface CommandFeedbackEntry {
  readonly id: number;
  readonly tone: CommandFeedbackTone;
  readonly title: string;
  readonly count: number;
  readonly expiresAtMs: number;
}

export interface CommandFeedbackState {
  readonly entries: readonly CommandFeedbackEntry[];
  readonly paused: boolean;
}

export interface CommandFeedbackStore {
  snapshot: () => CommandFeedbackState;
  publish: (tone: CommandFeedbackTone, title: string, nowMs: number) => CommandFeedbackState;
  /** Removes entries whose expiry has passed. No-op while paused. */
  expire: (nowMs: number) => CommandFeedbackState;
  /** Pause the expiry clock (pointer over / focus within the region). */
  pause: (nowMs: number) => CommandFeedbackState;
  /** Resume the expiry clock, shifting deadlines by the paused duration. */
  resume: (nowMs: number) => CommandFeedbackState;
  dismiss: (id: number) => CommandFeedbackState;
  subscribe: (listener: () => void) => () => void;
}

export const COMMAND_FEEDBACK_MAX_ENTRIES = 4;
export const COMMAND_FEEDBACK_DURATION_MS = 4000;

export function createCommandFeedbackStore(
  options: Readonly<{ maxEntries?: number; durationMs?: number }> = {},
): CommandFeedbackStore {
  const maxEntries = options.maxEntries ?? COMMAND_FEEDBACK_MAX_ENTRIES;
  const durationMs = options.durationMs ?? COMMAND_FEEDBACK_DURATION_MS;
  let entries: CommandFeedbackEntry[] = [];
  let paused = false;
  let pausedAtMs = 0;
  let nextId = 1;
  let state: CommandFeedbackState = { entries, paused };
  const listeners = new Set<() => void>();

  function commit(): CommandFeedbackState {
    state = { entries: [...entries], paused };
    for (const listener of listeners) listener();
    return state;
  }

  function snapshot(): CommandFeedbackState {
    return state;
  }

  function publish(tone: CommandFeedbackTone, title: string, nowMs: number): CommandFeedbackState {
    const existing = entries.find((entry) => entry.tone === tone && entry.title === title);
    if (existing) {
      entries = entries.map((entry) =>
        entry === existing
          ? { ...entry, count: entry.count + 1, expiresAtMs: nowMs + durationMs }
          : entry,
      );
      return commit();
    }
    entries = [...entries, { id: nextId, tone, title, count: 1, expiresAtMs: nowMs + durationMs }];
    nextId += 1;
    if (entries.length > maxEntries) entries = entries.slice(entries.length - maxEntries);
    return commit();
  }

  function expire(nowMs: number): CommandFeedbackState {
    if (paused) return state;
    const remaining = entries.filter((entry) => entry.expiresAtMs > nowMs);
    if (remaining.length === entries.length) return state;
    entries = remaining;
    return commit();
  }

  function pause(nowMs: number): CommandFeedbackState {
    if (paused) return state;
    paused = true;
    pausedAtMs = nowMs;
    return commit();
  }

  function resume(nowMs: number): CommandFeedbackState {
    if (!paused) return state;
    paused = false;
    const pausedFor = Math.max(0, nowMs - pausedAtMs);
    entries = entries.map((entry) => ({ ...entry, expiresAtMs: entry.expiresAtMs + pausedFor }));
    return commit();
  }

  function dismiss(id: number): CommandFeedbackState {
    const remaining = entries.filter((entry) => entry.id !== id);
    if (remaining.length === entries.length) return state;
    entries = remaining;
    return commit();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { snapshot, publish, expire, pause, resume, dismiss, subscribe };
}

/** "Wall drawn" + count 3 -> "Wall drawn ×3"; count 1 passes through unchanged. */
export function formatFeedbackTitle(entry: Pick<CommandFeedbackEntry, 'title' | 'count'>): string {
  return entry.count > 1 ? `${entry.title} ×${entry.count}` : entry.title;
}

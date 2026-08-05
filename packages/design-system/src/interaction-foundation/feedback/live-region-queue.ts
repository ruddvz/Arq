/**
 * V3-147: rate-limit what reaches a screen reader.
 *
 * `top-bar.tsx` already renders `aria-live="polite"` regions for save and sync
 * state, and that is right for state that changes a few times a minute. It is
 * wrong the moment the same mechanism is pointed at anything continuous. The
 * status bar reports pointer coordinates; a live region bound to those would
 * queue an announcement per pointer move, and a screen reader speaks them in
 * order, so the user hears a position from thirty seconds ago while the cursor
 * is somewhere else. The application has not crashed and has not gone silent -
 * it has become unusable in a way that is invisible to anyone not using it that
 * way, which is why this needs a mechanism rather than care.
 *
 * Three rules, and each of them is a decision about what a user actually needs
 * to hear:
 *
 * - Within a region, only the newest message survives. Intermediate coordinates
 *   are not information the user wanted; the current position is. Queueing them
 *   is strictly worse than dropping them.
 * - Assertive messages are never coalesced away or delayed. An error, a
 *   refusal, a destructive confirmation - these are the announcements a rate
 *   limit exists to protect, not to throttle, and a limiter that drops one has
 *   inverted its own purpose.
 * - A message identical to the one just announced is re-emitted with a
 *   mechanism that makes a reader speak it again. Screen readers ignore an
 *   unchanged live region, so "Snap: endpoint" announced, cleared, and
 *   announced again is silent the second time - and "the snap is still
 *   endpoint" is exactly what a user re-checking needs to hear.
 */

export type LivePoliteness = 'polite' | 'assertive';

export interface LiveMessage {
  readonly regionId: string;
  readonly text: string;
  readonly politeness: LivePoliteness;
}

export interface LiveAnnouncement extends LiveMessage {
  /**
   * Incremented when the text repeats. A renderer appends a matching number of
   * zero-width spaces (or re-keys the node) so the region's content differs and
   * the reader speaks it again.
   */
  readonly repeatToken: number;
}

/** Provisional: fast enough to feel current, slow enough that speech keeps up. Tune against real screen reader testing. */
export const DEFAULT_POLITE_INTERVAL_MS = 500;

export interface LiveRegionQueueOptions {
  readonly politeIntervalMs?: number;
  /** Injected so this is testable without timers and without a clock. */
  readonly now: () => number;
}

/**
 * Coalescing queue for live-region announcements.
 *
 * Deliberately pull-based: `drain(now)` returns what should be announced, and
 * the caller decides when to ask. A push-based version would own a timer, which
 * would make it untestable without fake timers and would keep firing after the
 * surface it announces into is gone.
 */
export function createLiveRegionQueue(options: LiveRegionQueueOptions) {
  const interval = options.politeIntervalMs ?? DEFAULT_POLITE_INTERVAL_MS;

  /** Newest pending message per region. Older ones are replaced, not queued. */
  const pending = new Map<string, LiveMessage>();
  const lastAnnouncedAt = new Map<string, number>();
  const lastText = new Map<string, string>();
  const repeatTokens = new Map<string, number>();
  const assertive: LiveMessage[] = [];

  function announce(message: LiveMessage): void {
    if (message.politeness === 'assertive') {
      // Kept in order and never coalesced: two different errors are two things
      // the user has to hear, and collapsing them loses one.
      assertive.push(message);
      return;
    }
    pending.set(message.regionId, message);
  }

  /**
   * Everything due now.
   *
   * Assertive messages come first and always. A polite message is due only if
   * its region has been quiet for the interval, which is per-region rather than
   * global: the coordinate readout settling should not delay a snap
   * announcement that has been waiting.
   */
  function drain(now: number = options.now()): readonly LiveAnnouncement[] {
    const announcements: LiveAnnouncement[] = [];

    while (assertive.length > 0) {
      const message = assertive.shift();
      if (message !== undefined) {
        announcements.push(withRepeatToken(message));
      }
    }

    for (const [regionId, message] of [...pending]) {
      const last = lastAnnouncedAt.get(regionId);
      if (last !== undefined && now - last < interval) {
        continue;
      }
      pending.delete(regionId);
      lastAnnouncedAt.set(regionId, now);
      announcements.push(withRepeatToken(message));
    }

    return announcements;
  }

  function withRepeatToken(message: LiveMessage): LiveAnnouncement {
    const previous = lastText.get(message.regionId);
    const token = previous === message.text ? (repeatTokens.get(message.regionId) ?? 0) + 1 : 0;
    repeatTokens.set(message.regionId, token);
    lastText.set(message.regionId, message.text);
    return { ...message, repeatToken: token };
  }

  /** When the next polite message becomes due, or null if nothing is waiting. */
  function nextDueAt(now: number = options.now()): number | null {
    let earliest: number | null = null;
    for (const regionId of pending.keys()) {
      const last = lastAnnouncedAt.get(regionId);
      const due = last === undefined ? now : last + interval;
      if (earliest === null || due < earliest) {
        earliest = due;
      }
    }
    return assertive.length > 0 ? now : earliest;
  }

  function pendingCount(): number {
    return pending.size + assertive.length;
  }

  /**
   * Drops everything waiting.
   *
   * For a surface being torn down. Announcing a project's snap state after the
   * project closed is worse than saying nothing: the user is somewhere else,
   * and the announcement describes a thing that is gone.
   */
  function clear(): void {
    pending.clear();
    assertive.length = 0;
  }

  return { announce, drain, nextDueAt, pendingCount, clear };
}

export type LiveRegionQueue = ReturnType<typeof createLiveRegionQueue>;

/**
 * The text a renderer puts in the region.
 *
 * The zero-width spaces are the mechanism, not decoration: a live region whose
 * text is byte-identical to what it held before is ignored, so a repeat needs
 * to differ by something a reader does not speak.
 */
export function liveRegionText(announcement: LiveAnnouncement): string {
  return announcement.repeatToken === 0
    ? announcement.text
    : `${announcement.text}${'​'.repeat(announcement.repeatToken)}`;
}

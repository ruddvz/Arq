import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POLITE_INTERVAL_MS,
  createLiveRegionQueue,
  liveRegionText,
} from './live-region-queue';

function queueAt(start = 0) {
  let clock = start;
  const queue = createLiveRegionQueue({ now: () => clock });
  return {
    queue,
    advance(ms: number) {
      clock += ms;
      return clock;
    },
    get now() {
      return clock;
    },
  };
}

describe('createLiveRegionQueue', () => {
  it('announces a polite message straight away when the region has been quiet', () => {
    const { queue } = queueAt();

    queue.announce({ regionId: 'status', text: 'Snap: endpoint', politeness: 'polite' });

    expect(queue.drain(0).map((a) => a.text)).toEqual(['Snap: endpoint']);
  });

  it('keeps only the newest message per region', () => {
    // Intermediate coordinates are not information the user wanted; the
    // current position is. Queueing them is strictly worse than dropping them.
    const { queue } = queueAt();

    queue.announce({ regionId: 'coords', text: 'x 100, y 200', politeness: 'polite' });
    queue.announce({ regionId: 'coords', text: 'x 150, y 200', politeness: 'polite' });
    queue.announce({ regionId: 'coords', text: 'x 900, y 400', politeness: 'polite' });

    expect(queue.drain(0).map((a) => a.text)).toEqual(['x 900, y 400']);
  });

  it('holds a region quiet for the interval after it speaks', () => {
    const { queue } = queueAt();

    queue.announce({ regionId: 'coords', text: 'first', politeness: 'polite' });
    queue.drain(0);

    queue.announce({ regionId: 'coords', text: 'second', politeness: 'polite' });
    expect(queue.drain(DEFAULT_POLITE_INTERVAL_MS - 1)).toEqual([]);
    expect(queue.drain(DEFAULT_POLITE_INTERVAL_MS).map((a) => a.text)).toEqual(['second']);
  });

  it('rate-limits per region, so one busy readout does not gag another', () => {
    const { queue } = queueAt();

    queue.announce({ regionId: 'coords', text: 'x 1', politeness: 'polite' });
    queue.drain(0);
    queue.announce({ regionId: 'coords', text: 'x 2', politeness: 'polite' });
    queue.announce({ regionId: 'snap', text: 'Snap: midpoint', politeness: 'polite' });

    expect(queue.drain(10).map((a) => a.text)).toEqual(['Snap: midpoint']);
  });

  it('never delays an assertive message', () => {
    // An error is what a rate limit exists to protect, not to throttle.
    const { queue } = queueAt();

    queue.announce({ regionId: 'alerts', text: 'x 1', politeness: 'polite' });
    queue.drain(0);
    queue.announce({ regionId: 'alerts', text: 'Wall not created', politeness: 'assertive' });

    expect(queue.drain(1).map((a) => a.text)).toEqual(['Wall not created']);
  });

  it('never coalesces two assertive messages into one', () => {
    const { queue } = queueAt();

    queue.announce({ regionId: 'alerts', text: 'Wall not created', politeness: 'assertive' });
    queue.announce({ regionId: 'alerts', text: 'Door not placed', politeness: 'assertive' });

    // Two different refusals are two things the user has to hear.
    expect(queue.drain(0).map((a) => a.text)).toEqual(['Wall not created', 'Door not placed']);
  });

  it('puts assertive messages ahead of polite ones in the same drain', () => {
    const { queue } = queueAt();

    queue.announce({ regionId: 'status', text: 'Saved', politeness: 'polite' });
    queue.announce({ regionId: 'alerts', text: 'Save failed', politeness: 'assertive' });

    expect(queue.drain(0).map((a) => a.text)).toEqual(['Save failed', 'Saved']);
  });

  it('marks a repeat so a reader speaks unchanged text again', () => {
    // Screen readers ignore an unchanged live region, and "the snap is still
    // endpoint" is exactly what a user re-checking needs to hear.
    const { queue } = queueAt();

    queue.announce({ regionId: 'snap', text: 'Snap: endpoint', politeness: 'polite' });
    const first = queue.drain(0);
    queue.announce({ regionId: 'snap', text: 'Snap: endpoint', politeness: 'polite' });
    const second = queue.drain(DEFAULT_POLITE_INTERVAL_MS);

    expect(first[0]?.repeatToken).toBe(0);
    expect(second[0]?.repeatToken).toBe(1);
    expect(liveRegionText(first[0]!)).not.toBe(liveRegionText(second[0]!));
  });

  it('resets the repeat marker when the text changes', () => {
    const { queue } = queueAt();

    queue.announce({ regionId: 'snap', text: 'Snap: endpoint', politeness: 'polite' });
    queue.drain(0);
    queue.announce({ regionId: 'snap', text: 'Snap: endpoint', politeness: 'polite' });
    queue.drain(DEFAULT_POLITE_INTERVAL_MS);
    queue.announce({ regionId: 'snap', text: 'Snap: midpoint', politeness: 'polite' });

    expect(queue.drain(DEFAULT_POLITE_INTERVAL_MS * 2)[0]?.repeatToken).toBe(0);
  });

  it('says when the next message is due, so a caller need not poll', () => {
    const { queue } = queueAt();

    queue.announce({ regionId: 'coords', text: 'x 1', politeness: 'polite' });
    queue.drain(0);
    queue.announce({ regionId: 'coords', text: 'x 2', politeness: 'polite' });

    expect(queue.nextDueAt(10)).toBe(DEFAULT_POLITE_INTERVAL_MS);
  });

  it('reports an assertive message as due immediately', () => {
    const { queue } = queueAt();

    queue.announce({ regionId: 'alerts', text: 'Save failed', politeness: 'assertive' });

    expect(queue.nextDueAt(42)).toBe(42);
  });

  it('has nothing due when nothing is waiting', () => {
    const { queue } = queueAt();

    expect(queue.nextDueAt(0)).toBeNull();
    expect(queue.pendingCount()).toBe(0);
  });

  it('drops everything on teardown, rather than describing a project that is gone', () => {
    const { queue } = queueAt();

    queue.announce({ regionId: 'snap', text: 'Snap: endpoint', politeness: 'polite' });
    queue.announce({ regionId: 'alerts', text: 'Save failed', politeness: 'assertive' });
    queue.clear();

    expect(queue.pendingCount()).toBe(0);
    expect(queue.drain(0)).toEqual([]);
  });

  it('survives a burst without queueing a backlog', () => {
    const { queue } = queueAt();

    for (let index = 0; index < 1000; index += 1) {
      queue.announce({ regionId: 'coords', text: `x ${index}`, politeness: 'polite' });
    }

    // A reader speaks in order, so a thousand queued positions would report a
    // cursor location half a minute stale.
    expect(queue.pendingCount()).toBe(1);
    expect(queue.drain(0)).toHaveLength(1);
  });
});

describe('liveRegionText', () => {
  it('is the text itself on a first announcement', () => {
    expect(
      liveRegionText({ regionId: 'r', text: 'Saved', politeness: 'polite', repeatToken: 0 }),
    ).toBe('Saved');
  });

  it('differs by characters a reader does not speak on a repeat', () => {
    const repeated = liveRegionText({
      regionId: 'r',
      text: 'Saved',
      politeness: 'polite',
      repeatToken: 2,
    });

    expect(repeated).not.toBe('Saved');
    expect(repeated.startsWith('Saved')).toBe(true);
    expect(repeated.replace(/​/g, '')).toBe('Saved');
  });
});

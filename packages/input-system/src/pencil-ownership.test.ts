import { describe, expect, it } from 'vitest';
import {
  NO_OWNER,
  createPencilOwnershipTracker,
  reachesTool,
  reachesViewport,
  type PointerEventSample,
} from './pencil-ownership';

function down(pointerId: number, pointerType: string): PointerEventSample {
  return { pointerId, pointerType, phase: 'down' };
}
function move(pointerId: number, pointerType: string): PointerEventSample {
  return { pointerId, pointerType, phase: 'move' };
}
function up(pointerId: number, pointerType: string): PointerEventSample {
  return { pointerId, pointerType, phase: 'up' };
}

describe('createPencilOwnershipTracker', () => {
  it('gives the gesture to the first pointer down', () => {
    const tracker = createPencilOwnershipTracker();

    const decision = tracker.handle(down(1, 'pen'));

    expect(decision.disposition).toBe('owns');
    expect(tracker.currentOwner()).toEqual({ kind: 'owned', pointerId: 1, role: 'pencil' });
  });

  it('rejects a palm that lands while the Pencil is drawing', () => {
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'pen'));

    const palm = tracker.handle(down(2, 'touch'));

    expect(palm.disposition).toBe('palm-rejected');
    expect(reachesTool(palm.disposition)).toBe(false);
  });

  it('reports a rejected palm rather than dropping it silently', () => {
    // Silence is indistinguishable from a dropped event, and the difference
    // matters when the touch was a deliberate second finger.
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'pen'));

    expect(tracker.handle(down(2, 'touch')).disposition).toBe('palm-rejected');
    expect(tracker.rejectedCount()).toBe(1);
  });

  it('does not end the stroke when the palm lifts after the Pencil', () => {
    // The naive rule ends the stroke at the palm's position, which draws a wall
    // to the user's wrist.
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'pen'));
    tracker.handle(down(2, 'touch'));

    const palmUp = tracker.handle(up(2, 'touch'));

    expect(palmUp.endsGesture).toBe(false);
    expect(tracker.currentOwner()).toMatchObject({ pointerId: 1 });
  });

  it('ends the gesture exactly once, when the owning pointer lifts', () => {
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'pen'));
    tracker.handle(down(2, 'touch'));

    const pencilUp = tracker.handle(up(1, 'pen'));
    const palmUp = tracker.handle(up(2, 'touch'));

    expect(pencilUp.endsGesture).toBe(true);
    expect(palmUp.endsGesture).toBe(false);
    expect(tracker.currentOwner()).toEqual(NO_OWNER);
  });

  it('lets a finger own the gesture when no Pencil is present', () => {
    // This resolves a conflict that only exists while both are down; it does
    // not privilege a stylus over people who do not use one.
    const tracker = createPencilOwnershipTracker();

    const decision = tracker.handle(down(1, 'touch'));

    expect(decision.disposition).toBe('owns');
    expect(reachesTool(decision.disposition)).toBe(true);
  });

  it('lets a Pencil take over from a finger mid-gesture', () => {
    // Someone who starts with a finger and then picks up the Pencil means the
    // Pencil.
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'touch'));

    const pencil = tracker.handle(down(2, 'pen'));

    expect(pencil.disposition).toBe('owns');
    expect(tracker.currentOwner()).toEqual({ kind: 'owned', pointerId: 2, role: 'pencil' });
  });

  it('does not let the displaced finger end the gesture', () => {
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'touch'));
    tracker.handle(down(2, 'pen'));

    expect(tracker.handle(up(1, 'touch')).endsGesture).toBe(false);
    expect(tracker.currentOwner()).toMatchObject({ pointerId: 2 });
  });

  it('treats a second finger as a viewport gesture, not a palm', () => {
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'touch'));

    const second = tracker.handle(down(2, 'touch'));

    expect(second.disposition).toBe('secondary');
    expect(reachesViewport(second.disposition)).toBe(true);
    expect(reachesTool(second.disposition)).toBe(false);
  });

  it('does not let a rejected palm pan the viewport', () => {
    // The canvas sliding under a resting hand is the same failure as the wall
    // being drawn to it.
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'pen'));

    expect(reachesViewport(tracker.handle(down(2, 'touch')).disposition)).toBe(false);
  });

  it('passes moves from the owning pointer through', () => {
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'pen'));

    const moved = tracker.handle(move(1, 'pen'));

    expect(moved.disposition).toBe('owns');
    expect(moved.endsGesture).toBe(false);
  });

  it('ignores moves from a rejected pointer', () => {
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'pen'));
    tracker.handle(down(2, 'touch'));

    expect(reachesTool(tracker.handle(move(2, 'touch')).disposition)).toBe(false);
  });

  it('ends the gesture on a cancel of the owning pointer', () => {
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'pen'));

    const cancelled = tracker.handle({ pointerId: 1, pointerType: 'pen', phase: 'cancel' });

    expect(cancelled.endsGesture).toBe(true);
    expect(tracker.currentOwner()).toEqual(NO_OWNER);
  });

  it('ignores an event for a pointer it never saw go down', () => {
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'pen'));

    const stray = tracker.handle(up(9, 'touch'));

    expect(stray.endsGesture).toBe(false);
    expect(tracker.currentOwner()).toMatchObject({ pointerId: 1 });
  });

  it('starts a fresh gesture cleanly after one ends', () => {
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'pen'));
    tracker.handle(down(2, 'touch'));
    tracker.handle(up(1, 'pen'));

    expect(tracker.rejectedCount()).toBe(0);
    expect(tracker.handle(down(3, 'touch')).disposition).toBe('owns');
  });

  it('drops everything on reset, for a tool cancel or lost capture', () => {
    const tracker = createPencilOwnershipTracker();
    tracker.handle(down(1, 'pen'));
    tracker.handle(down(2, 'touch'));
    tracker.reset();

    expect(tracker.currentOwner()).toEqual(NO_OWNER);
    expect(tracker.rejectedCount()).toBe(0);
  });
});

describe('reachesTool and reachesViewport', () => {
  it('route each disposition to exactly one place, or nowhere', () => {
    // One place to decide, so a caller cannot handle three cases and let the
    // fourth through.
    for (const disposition of ['owns', 'palm-rejected', 'secondary', 'ignored-release'] as const) {
      const both = Number(reachesTool(disposition)) + Number(reachesViewport(disposition));
      expect(both).toBeLessThanOrEqual(1);
    }
    expect(reachesTool('owns')).toBe(true);
    expect(reachesViewport('secondary')).toBe(true);
    expect(reachesTool('ignored-release')).toBe(false);
    expect(reachesViewport('ignored-release')).toBe(false);
  });
});

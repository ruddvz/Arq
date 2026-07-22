import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createPointerGestureTracker, DEFAULT_DRAG_THRESHOLD_PX } from './pointer-gesture';

describe('createPointerGestureTracker', () => {
  it('emits a tap when the pointer goes up without moving past the threshold', () => {
    const tracker = createPointerGestureTracker();
    expect(tracker.down({ pointerId: 1, x: 10, y: 10 })).toEqual([]);
    expect(tracker.move({ pointerId: 1, x: 11, y: 10 })).toEqual([]);
    expect(tracker.up({ pointerId: 1, x: 11, y: 10 })).toEqual([{ type: 'tap', x: 11, y: 10 }]);
  });

  it('emits drag-start once the threshold is crossed, then drag-move, then drag-end', () => {
    const tracker = createPointerGestureTracker(4);
    tracker.down({ pointerId: 1, x: 0, y: 0 });
    expect(tracker.move({ pointerId: 1, x: 1, y: 0 })).toEqual([]);
    // drag-move dx is measured from the *previous* sample (x=1, set by the
    // move above), not from the drag's start point - it is an incremental
    // delta suitable for feeding straight into panByScreenDelta each frame.
    expect(tracker.move({ pointerId: 1, x: 5, y: 0 })).toEqual([
      { type: 'drag-start', x: 0, y: 0 },
      { type: 'drag-move', dxScreen: 4, dyScreen: 0, x: 5, y: 0 },
    ]);
    expect(tracker.move({ pointerId: 1, x: 8, y: 2 })).toEqual([
      { type: 'drag-move', dxScreen: 3, dyScreen: 2, x: 8, y: 2 },
    ]);
    expect(tracker.up({ pointerId: 1, x: 8, y: 2 })).toEqual([{ type: 'drag-end', x: 8, y: 2 }]);
  });

  it('ignores a second concurrent pointer down while one is already active', () => {
    const tracker = createPointerGestureTracker();
    tracker.down({ pointerId: 1, x: 0, y: 0 });
    expect(tracker.down({ pointerId: 2, x: 50, y: 50 })).toEqual([]);
    // moves for the untracked pointer id are ignored
    expect(tracker.move({ pointerId: 2, x: 60, y: 60 })).toEqual([]);
  });

  it('emits cancel and clears state, allowing a fresh gesture to start', () => {
    const tracker = createPointerGestureTracker();
    tracker.down({ pointerId: 1, x: 0, y: 0 });
    tracker.move({ pointerId: 1, x: 20, y: 0 });
    expect(tracker.cancel()).toEqual([{ type: 'cancel' }]);
    expect(tracker.cancel()).toEqual([]);
    expect(tracker.down({ pointerId: 2, x: 5, y: 5 })).toEqual([]);
    expect(tracker.up({ pointerId: 2, x: 5, y: 5 })).toEqual([{ type: 'tap', x: 5, y: 5 }]);
  });

  it('never reports drag-move before drag-start regardless of the path taken (property-based)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ x: fc.integer({ min: -50, max: 50 }), y: fc.integer({ min: -50, max: 50 }) }),
          {
            minLength: 1,
            maxLength: 20,
          },
        ),
        (path) => {
          const tracker = createPointerGestureTracker(DEFAULT_DRAG_THRESHOLD_PX);
          tracker.down({ pointerId: 1, x: 0, y: 0 });
          let sawDragStart = false;
          for (const { x, y } of path) {
            for (const event of tracker.move({ pointerId: 1, x, y })) {
              if (event.type === 'drag-start') {
                sawDragStart = true;
              }
              if (event.type === 'drag-move') {
                expect(sawDragStart).toBe(true);
              }
            }
          }
        },
      ),
    );
  });
});

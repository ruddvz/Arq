import { describe, expect, it } from 'vitest';
import { createTwoFingerGestureTracker } from './touch-gesture';

describe('createTwoFingerGestureTracker', () => {
  it('emits nothing for zero or one touch point', () => {
    const tracker = createTwoFingerGestureTracker();
    expect(tracker.update([])).toEqual([]);
    expect(tracker.update([{ id: 1, x: 0, y: 0 }])).toEqual([]);
  });

  it('emits pinch-start on the first frame with two touches, then no pinch-move until a second frame arrives', () => {
    const tracker = createTwoFingerGestureTracker();
    const events = tracker.update([
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 100, y: 0 },
    ]);
    expect(events).toEqual([{ type: 'pinch-start' }]);
  });

  it('reports zoomFactor > 1 and the correct centroid pan when fingers spread apart while moving together', () => {
    const tracker = createTwoFingerGestureTracker();
    tracker.update([
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 100, y: 0 },
    ]);
    // finger 1 moves +10 in x, finger 2 moves +50 in x: centroid (pan) moves
    // from 50 to 80 (+30), and spread grows from 100 to 140 (zoom in).
    const events = tracker.update([
      { id: 1, x: 10, y: 0 },
      { id: 2, x: 150, y: 0 },
    ]);
    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.type).toBe('pinch-move');
    if (event.type === 'pinch-move') {
      expect(event.panDxScreen).toBeCloseTo(30, 10);
      expect(event.panDyScreen).toBeCloseTo(0, 10);
      expect(event.zoomFactor).toBeCloseTo(140 / 100, 10);
      expect(event.anchorX).toBeCloseTo(80, 10);
    }
  });

  it('keeps tracking the original two fingers when a third touches down, ignoring it', () => {
    const tracker = createTwoFingerGestureTracker();
    tracker.update([
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 100, y: 0 },
    ]);
    const events = tracker.update([
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 100, y: 0 },
      { id: 3, x: 500, y: 500 },
    ]);
    // no movement in the tracked pair -> spread/centre unchanged -> a pinch-move
    // event is still emitted (zoomFactor 1, zero pan), the third finger has no effect.
    expect(events).toEqual([
      {
        type: 'pinch-move',
        panDxScreen: 0,
        panDyScreen: 0,
        zoomFactor: 1,
        anchorX: 50,
        anchorY: 0,
      },
    ]);
  });

  it('emits pinch-end when a tracked finger lifts, and can start a fresh gesture afterwards', () => {
    const tracker = createTwoFingerGestureTracker();
    tracker.update([
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 100, y: 0 },
    ]);
    expect(tracker.update([{ id: 1, x: 0, y: 0 }])).toEqual([{ type: 'pinch-end' }]);
    expect(
      tracker.update([
        { id: 4, x: 0, y: 0 },
        { id: 5, x: 20, y: 0 },
      ]),
    ).toEqual([{ type: 'pinch-start' }]);
  });

  it('end() emits pinch-end exactly once for an active gesture and nothing when idle', () => {
    const tracker = createTwoFingerGestureTracker();
    expect(tracker.end()).toEqual([]);
    tracker.update([
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 100, y: 0 },
    ]);
    expect(tracker.end()).toEqual([{ type: 'pinch-end' }]);
    expect(tracker.end()).toEqual([]);
  });
});

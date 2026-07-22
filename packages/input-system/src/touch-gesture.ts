/**
 * ARQ-036: touch input abstraction.
 *
 * Two-finger pinch/pan recognition: turns a per-frame set of active touch
 * points into pan deltas and a zoom factor, ready to feed straight into
 * @arq/editor-shell's panByScreenDelta / zoomAtScreenPoint. Deliberately
 * DOM-free (plain {id, x, y} samples, not TouchEvent/TouchList) so it is
 * testable without a browser and independent of any input library choice.
 *
 * Single-finger touch (tap/drag) is not handled here - a lone touch point
 * is just a pointer, so it goes through pointer-gesture.ts's tracker like
 * mouse and pen input do.
 */

export interface TouchSample {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

export type TouchGestureEvent =
  | { readonly type: 'pinch-start' }
  | {
      readonly type: 'pinch-move';
      readonly panDxScreen: number;
      readonly panDyScreen: number;
      readonly zoomFactor: number;
      readonly anchorX: number;
      readonly anchorY: number;
    }
  | { readonly type: 'pinch-end' };

interface TwoFingerFrame {
  readonly centerX: number;
  readonly centerY: number;
  readonly spread: number;
}

function frameOf(a: TouchSample, b: TouchSample): TwoFingerFrame {
  return {
    centerX: (a.x + b.x) / 2,
    centerY: (a.y + b.y) / 2,
    spread: Math.hypot(a.x - b.x, a.y - b.y),
  };
}

/**
 * Tracks exactly the two lowest-id active touches as a pinch gesture.
 * A third finger touching down is ignored (still tracks the original
 * pair) rather than restarting the gesture, so an accidental extra
 * contact doesn't jump the view.
 */
export function createTwoFingerGestureTracker() {
  let previous: TwoFingerFrame | null = null;
  let trackedIds: readonly [number, number] | null = null;

  function update(touches: readonly TouchSample[]): readonly TouchGestureEvent[] {
    if (trackedIds) {
      const [idA, idB] = trackedIds;
      const a = touches.find((t) => t.id === idA);
      const b = touches.find((t) => t.id === idB);
      if (!a || !b) {
        previous = null;
        trackedIds = null;
        return [{ type: 'pinch-end' }];
      }
      const frame = frameOf(a, b);
      const events: TouchGestureEvent[] = [];
      if (previous && previous.spread > 0 && frame.spread > 0) {
        events.push({
          type: 'pinch-move',
          panDxScreen: frame.centerX - previous.centerX,
          panDyScreen: frame.centerY - previous.centerY,
          zoomFactor: frame.spread / previous.spread,
          anchorX: frame.centerX,
          anchorY: frame.centerY,
        });
      }
      previous = frame;
      return events;
    }

    if (touches.length >= 2) {
      const sorted = [...touches].sort((x, y) => x.id - y.id);
      const a = sorted[0]!;
      const b = sorted[1]!;
      trackedIds = [a.id, b.id];
      previous = frameOf(a, b);
      return [{ type: 'pinch-start' }];
    }

    return [];
  }

  function end(): readonly TouchGestureEvent[] {
    if (!trackedIds) {
      return [];
    }
    previous = null;
    trackedIds = null;
    return [{ type: 'pinch-end' }];
  }

  return { update, end };
}

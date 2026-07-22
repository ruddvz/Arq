/**
 * ARQ-035: pointer input abstraction.
 *
 * Turns a stream of raw pointer samples (down/move/up/cancel) into
 * higher-level gesture intents - tap vs. drag - so callers (editor tools,
 * viewport panning) don't each re-implement drag-threshold detection.
 * Deliberately DOM-free: it accepts plain {pointerId, x, y} samples rather
 * than PointerEvent, so it is testable without a browser/jsdom and usable
 * from any input source (mouse, pen, a single simulated touch point).
 */

export interface PointerSample {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}

export type PointerGestureEvent =
  | { readonly type: 'tap'; readonly x: number; readonly y: number }
  | { readonly type: 'drag-start'; readonly x: number; readonly y: number }
  | {
      readonly type: 'drag-move';
      readonly dxScreen: number;
      readonly dyScreen: number;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'drag-end'; readonly x: number; readonly y: number }
  | { readonly type: 'cancel' };

export const DEFAULT_DRAG_THRESHOLD_PX = 4;

interface TrackedPointer {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  dragging: boolean;
}

/**
 * A single-pointer gesture tracker. Only one pointer is tracked at a time -
 * a second concurrent `down()` is ignored until the first pointer goes up
 * or is cancelled, since a single tracker instance models one input
 * "slot" (multi-touch composition, e.g. two-finger pinch, is a separate
 * concern - see touch-gesture.ts).
 */
export function createPointerGestureTracker(dragThresholdPx: number = DEFAULT_DRAG_THRESHOLD_PX) {
  let active: TrackedPointer | null = null;

  function down(sample: PointerSample): readonly PointerGestureEvent[] {
    if (active) {
      return [];
    }
    active = {
      pointerId: sample.pointerId,
      startX: sample.x,
      startY: sample.y,
      lastX: sample.x,
      lastY: sample.y,
      dragging: false,
    };
    return [];
  }

  function move(sample: PointerSample): readonly PointerGestureEvent[] {
    if (!active || active.pointerId !== sample.pointerId) {
      return [];
    }
    const events: PointerGestureEvent[] = [];
    if (!active.dragging) {
      const distance = Math.hypot(sample.x - active.startX, sample.y - active.startY);
      if (distance >= dragThresholdPx) {
        active.dragging = true;
        events.push({ type: 'drag-start', x: active.startX, y: active.startY });
      }
    }
    if (active.dragging) {
      events.push({
        type: 'drag-move',
        dxScreen: sample.x - active.lastX,
        dyScreen: sample.y - active.lastY,
        x: sample.x,
        y: sample.y,
      });
    }
    active.lastX = sample.x;
    active.lastY = sample.y;
    return events;
  }

  function up(sample: PointerSample): readonly PointerGestureEvent[] {
    if (!active || active.pointerId !== sample.pointerId) {
      return [];
    }
    const wasDragging = active.dragging;
    active = null;
    return [
      wasDragging
        ? { type: 'drag-end', x: sample.x, y: sample.y }
        : { type: 'tap', x: sample.x, y: sample.y },
    ];
  }

  /** The platform cancelled the gesture (e.g. a browser-native gesture took over). */
  function cancel(): readonly PointerGestureEvent[] {
    if (!active) {
      return [];
    }
    active = null;
    return [{ type: 'cancel' }];
  }

  return { down, move, up, cancel };
}

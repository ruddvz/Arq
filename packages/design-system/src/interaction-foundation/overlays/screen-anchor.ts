import type { VirtualElement } from '@floating-ui/react';

/**
 * A client-coordinate point (CSS pixels, viewport-relative). Callers own the
 * conversion from world coordinates through their viewport transform and
 * device-pixel ratio BEFORE a point becomes a DOM anchor - this module never
 * sees world, canvas or device-pixel space (the explicit conversion boundary
 * docs 03-CONTEXT-HUD requires).
 */
export type ScreenPoint = Readonly<{ x: number; y: number }>;

/**
 * A Floating UI virtual element that reads its position from a mutable ref.
 * The element identity is stable for the lifetime of the ref, so overlay
 * middleware is never rebuilt when the pointer moves: the caller mutates
 * `ref.current` and asks the overlay to reposition imperatively. That keeps
 * high-frequency pointer truth out of React state entirely - anchoring a HUD
 * to the pointer costs zero React renders per move.
 */
export function createScreenPointAnchor(ref: {
  readonly current: ScreenPoint | null;
}): VirtualElement {
  return {
    getBoundingClientRect(): DOMRect {
      const point = ref.current ?? { x: -10000, y: -10000 };
      return {
        x: point.x,
        y: point.y,
        top: point.y,
        right: point.x,
        bottom: point.y,
        left: point.x,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  };
}

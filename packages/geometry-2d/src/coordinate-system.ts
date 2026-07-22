/**
 * ARQ-032: coordinate systems.
 *
 * Two spaces, kept structurally distinct so a screen coordinate can never be
 * silently used as a world coordinate (or vice versa) without an explicit
 * conversion - that mistake is exactly how BUG-RISK-class hit-testing and
 * snapping bugs happen.
 *
 * - World space: project/model units, y-up, origin wherever the project's
 *   first level was authored. This is what gets stored - see
 *   docs/adr/0004-units-and-numeric-representation.md, which is still
 *   "Research required": the canonical unit (mm vs m, fixed vs floating
 *   point) is NOT decided. This module uses plain floating-point numbers
 *   as a provisional, easily-swappable choice consistent with
 *   contracts/model.ts's existing Point2 - it must not be read as that ADR
 *   having been resolved.
 * - Screen space: CSS pixels, y-down, origin at the canvas's top-left.
 */

export type Brand<T, N extends string> = T & { readonly __brand: N };

export interface WorldPoint {
  readonly x: Brand<number, 'WorldX'>;
  readonly y: Brand<number, 'WorldY'>;
}

export interface ScreenPoint {
  readonly x: Brand<number, 'ScreenX'>;
  readonly y: Brand<number, 'ScreenY'>;
}

export function worldPoint(x: number, y: number): WorldPoint {
  return { x: x as WorldPoint['x'], y: y as WorldPoint['y'] };
}

export function screenPoint(x: number, y: number): ScreenPoint {
  return { x: x as ScreenPoint['x'], y: y as ScreenPoint['y'] };
}

/**
 * The camera/view transform: where world space currently sits relative to
 * the screen. `center` is the world point rendered at the centre of the
 * canvas; `pixelsPerUnit` is the current zoom level.
 */
export interface Viewport {
  readonly center: WorldPoint;
  readonly pixelsPerUnit: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
}

export function worldToScreen(viewport: Viewport, point: WorldPoint): ScreenPoint {
  const dx = (point.x - viewport.center.x) * viewport.pixelsPerUnit;
  const dy = (point.y - viewport.center.y) * viewport.pixelsPerUnit;
  return screenPoint(viewport.screenWidth / 2 + dx, viewport.screenHeight / 2 - dy);
}

export function screenToWorld(viewport: Viewport, point: ScreenPoint): WorldPoint {
  const dx = (point.x - viewport.screenWidth / 2) / viewport.pixelsPerUnit;
  const dy = (point.y - viewport.screenHeight / 2) / viewport.pixelsPerUnit;
  return worldPoint(viewport.center.x + dx, viewport.center.y - dy);
}

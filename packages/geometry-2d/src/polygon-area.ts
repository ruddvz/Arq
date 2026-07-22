/**
 * ARQ-085: implement polygon area and winding.
 *
 * The shoelace formula for a single-ring polygon's signed area, plus the
 * winding direction it implies (positive = counter-clockwise in this
 * codebase's y-up world space, matching coordinate-system.ts's
 * convention; negative = clockwise). Used for Room.calculatedArea
 * (contracts/model.ts) and, eventually, for deciding whether a room
 * boundary needs its vertex order reversed before triangulation/export.
 *
 * Scope limits, explicit rather than silently assumed:
 * - Single ring only. A polygon with a hole ("room containing island",
 *   blueprint section 42) is a multi-ring concept this module does not
 *   model - that is a separate, later concern.
 * - The shoelace sum is still a well-defined number for a
 *   self-intersecting polygon ("room with self-intersection", section
 *   42), but it does not represent the polygon's *enclosed* area in
 *   that case - detecting self-intersection is a distinct validity
 *   check this module does not perform. Callers needing a guarantee of
 *   simplicity must check for it separately.
 *
 * Tolerance behaviour: `windingOf` requires an explicit tolerance
 * (ARQ-081's policy) below which the signed area is treated as zero -
 * a polygon with fewer than 3 points, or whose points are exactly or
 * nearly collinear/coincident, has no meaningful winding and is
 * reported as 'degenerate' rather than an arbitrary clockwise/
 * counter-clockwise guess.
 */

import type { WorldPoint } from './coordinate-system';

/** The shoelace sum: positive for a counter-clockwise ring, negative for clockwise, in this codebase's y-up world space. Not the enclosed area for a self-intersecting polygon - see this module's doc comment. */
export function signedArea(polygon: readonly WorldPoint[]): number {
  if (polygon.length < 3) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** The polygon's unsigned area - always non-negative regardless of winding direction. */
export function polygonArea(polygon: readonly WorldPoint[]): number {
  return Math.abs(signedArea(polygon));
}

export type Winding = 'clockwise' | 'counter-clockwise' | 'degenerate';

export function windingOf(polygon: readonly WorldPoint[], tolerance: number): Winding {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return 'degenerate';
  }
  const area = signedArea(polygon);
  if (!Number.isFinite(area) || Math.abs(area) <= tolerance) {
    return 'degenerate';
  }
  return area > 0 ? 'counter-clockwise' : 'clockwise';
}

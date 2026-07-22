/**
 * ARQ-098: implement cross join.
 *
 * A cross join is two walls that genuinely cross each other, each
 * continuing straight through the junction on both sides - the
 * four-way meet, as opposed to a T join (t-join.ts, ARQ-097) where only
 * one wall (the through wall) spans the junction and the other (the
 * stem) merely ends there. The distinguishing test, the same "strictly
 * interior" definition t-join.ts uses: the crossing point must land
 * strictly inside *both* walls' own spans (parametric position in the
 * open interval (0,1) along each), not at or beyond either wall's
 * endpoint - a point at an endpoint means one of the "crossing" walls
 * actually just touches the other's end, which is a T or a corner, not
 * a true cross.
 *
 * Reuses segment-intersection.ts's segmentIntersection (ARQ-083)
 * directly for the crossing point itself (both walls' own bounds
 * already matter here, unlike butt/mitre/T which need
 * line-intersection.ts's unbounded lines to trim/extend beyond a
 * wall's original endpoints).
 */

import { segmentIntersection } from './segment-intersection';
import { dotProduct, subtractVectors, vector2, vectorBetween } from './vector';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

function parametricPositionAlong(segment: Segment, point: WorldPoint): number | null {
  const direction = vectorBetween(segment.start, segment.end);
  const lengthSquared = dotProduct(direction, direction);
  if (lengthSquared === 0) {
    return null;
  }
  const toPoint = subtractVectors(
    vector2(point.x, point.y),
    vector2(segment.start.x, segment.start.y),
  );
  return dotProduct(toPoint, direction) / lengthSquared;
}

export function crossJoinPoint(
  wallA: Segment,
  wallB: Segment,
  tolerance: number,
): WorldPoint | null {
  const point = segmentIntersection(wallA, wallB, tolerance);
  if (!point) {
    return null;
  }
  const tA = parametricPositionAlong(wallA, point);
  const tB = parametricPositionAlong(wallB, point);
  if (tA === null || tB === null) {
    return null;
  }
  return tA > 0 && tA < 1 && tB > 0 && tB < 1 ? point : null;
}

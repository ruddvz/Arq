/**
 * ARQ-097: implement T join.
 *
 * A T join is geometrically the same trim computation as a butt join
 * (butt-join.ts, ARQ-095) - a "stem" wall's end trimmed against a
 * "through" wall's near face - with one added, meaningful constraint: a
 * true T requires the junction to land strictly *inside* the through
 * wall's own span, not off either of its ends. If the computed point
 * falls at or beyond the through wall's own endpoints, this is not
 * actually a T (it would be a corner/butt situation against the through
 * wall's end instead, a different topology), so this function returns
 * null rather than silently returning a point that doesn't describe a
 * real T-junction.
 */

import { buttJoinPoint } from './butt-join';
import { dotProduct, subtractVectors, vector2, vectorBetween } from './vector';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';
import type { WallAlignment } from './wall-face-line';

export function tJoinPoint(
  throughWall: Segment,
  throughThickness: number,
  throughAlignment: WallAlignment,
  stemWallCenterline: Segment,
  tolerance: number,
): WorldPoint | null {
  const point = buttJoinPoint(
    throughWall,
    throughThickness,
    throughAlignment,
    stemWallCenterline,
    tolerance,
  );
  if (!point) {
    return null;
  }

  const direction = vectorBetween(throughWall.start, throughWall.end);
  const lengthSquared = dotProduct(direction, direction);
  if (lengthSquared === 0) {
    return null;
  }
  const toPoint = subtractVectors(
    vector2(point.x, point.y),
    vector2(throughWall.start.x, throughWall.start.y),
  );
  const t = dotProduct(toPoint, direction) / lengthSquared;

  return t > 0 && t < 1 ? point : null;
}

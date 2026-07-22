/**
 * ARQ-084: implement nearest point.
 *
 * The canonical closest-point-on-segment primitive, replacing the copy
 * that used to live in @arq/editor-shell's nearest-snap.ts (ARQ-046
 * cluster) - editor-shell now delegates here instead of duplicating the
 * math, the same consolidation done for segment intersection (ARQ-083).
 *
 * A zero-length segment is degenerate (see vector.ts's normalizeVector):
 * there is no meaningful "closest point along a direction" when the
 * segment has no direction, so this returns the segment's single point
 * instead - a defined, sensible answer for that adversarial case, not a
 * division-by-zero NaN.
 */

import {
  dotProduct,
  scaleVector,
  subtractVectors,
  translatePoint,
  vector2,
  type Vector2,
} from './vector';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

export function closestPointOnSegment(segment: Segment, point: WorldPoint): WorldPoint {
  const direction: Vector2 = vector2(
    segment.end.x - segment.start.x,
    segment.end.y - segment.start.y,
  );
  const lengthSquared = dotProduct(direction, direction);
  if (!Number.isFinite(lengthSquared) || lengthSquared === 0) {
    return segment.start;
  }
  const toPoint = subtractVectors(
    vector2(point.x, point.y),
    vector2(segment.start.x, segment.start.y),
  );
  const rawT = dotProduct(toPoint, direction) / lengthSquared;
  const t = Math.min(1, Math.max(0, rawT));
  return translatePoint(segment.start, scaleVector(direction, t));
}

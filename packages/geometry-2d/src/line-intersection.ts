/**
 * The infinite-line counterpart to segment-intersection.ts's
 * segmentIntersection (ARQ-083): where two lines cross, with no bounds
 * check against either input Segment's own start/end - needed by the
 * wall-join primitives (butt-join.ts/mitre-join.ts, ARQ-095/096), which
 * must find where a wall's face line meets another wall's face or
 * centerline *beyond* either wall's original endpoints (that is exactly
 * what "trimming" or "extending" a wall to a join means).
 *
 * Same near-parallel tolerance convention as segmentIntersection: a
 * sine-of-angle test, scale-independent.
 */

import {
  crossProduct,
  translatePoint,
  scaleVector,
  vectorBetween,
  vectorLength,
  type Vector2,
} from './vector';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

export function lineIntersection(a: Segment, b: Segment, tolerance: number): WorldPoint | null {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return null;
  }

  const dirA: Vector2 = vectorBetween(a.start, a.end);
  const dirB: Vector2 = vectorBetween(b.start, b.end);
  const lengthA = vectorLength(dirA);
  const lengthB = vectorLength(dirB);
  if (!Number.isFinite(lengthA) || !Number.isFinite(lengthB) || lengthA === 0 || lengthB === 0) {
    return null;
  }

  const denominator = crossProduct(dirA, dirB);
  if (!Number.isFinite(denominator) || Math.abs(denominator) <= tolerance * lengthA * lengthB) {
    return null;
  }

  const startDiff = vectorBetween(a.start, b.start);
  const t = crossProduct(startDiff, dirB) / denominator;
  if (!Number.isFinite(t)) {
    return null;
  }

  return translatePoint(a.start, scaleVector(dirA, t));
}

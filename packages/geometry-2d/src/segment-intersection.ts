/**
 * ARQ-083: implement segment intersections.
 *
 * The canonical, tolerance-aware segment-segment intersection primitive.
 * This replaces the ad hoc, exact-equality version that used to live in
 * @arq/editor-shell's intersection-snap.ts (ARQ-048) - that version used
 * `denominator === 0` to detect parallel segments, which is exactly the
 * "no random 1e-6 (or worse, no tolerance at all) in feature code"
 * problem ARQ-081's tolerance policy exists to prevent. editor-shell now
 * delegates to this function instead of duplicating the math.
 *
 * The near-parallel tolerance is expressed as sin(angle between the two
 * segments' directions), not as a raw coordinate epsilon: normalizing
 * the cross product by both segment lengths makes the tolerance
 * independent of segment scale (a caller passes the same tolerance
 * whether the segments are 1mm or 1km long), which is what
 * angularEpsilon-style tolerances (tolerance.ts, ARQ-081) are for.
 *
 * Zero-length segments have no defined direction and always return null
 * (see vector.ts's normalizeVector for the parallel rationale). Reversed
 * segment order (swapping a segment's start/end) does not change the
 * result, since the intersection point does not depend on which
 * endpoint is labelled "start".
 */

import {
  crossProduct,
  scaleVector,
  translatePoint,
  vectorBetween,
  vectorLength,
  type Vector2,
} from './vector';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

/**
 * Returns the intersection point of two segments if it falls within both
 * of their bounds (inclusive of endpoints), or null if they are
 * parallel/near-parallel (within `tolerance`, a sine-of-angle
 * tolerance), degenerate (zero-length), don't cross within their
 * bounds, or `tolerance` itself is invalid.
 */
export function segmentIntersection(a: Segment, b: Segment, tolerance: number): WorldPoint | null {
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
  const u = crossProduct(startDiff, dirA) / denominator;
  if (!Number.isFinite(t) || !Number.isFinite(u) || t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }

  return translatePoint(a.start, scaleVector(dirA, t));
}

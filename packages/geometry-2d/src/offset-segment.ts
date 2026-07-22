/**
 * ARQ-102: implement offset wall - the pure-geometry half.
 *
 * Generalises the offset math already used by wall-face-line.ts
 * (ARQ-093) from "one of two fixed faces of a wall's thickness" to "an
 * arbitrary signed perpendicular distance", so the offset tool (item 16
 * in the blueprint's first-40 toolbar list) can move a copy of any
 * segment sideways by a caller-chosen amount rather than only by half a
 * wall's thickness.
 *
 * Same left/right sign convention as wall-face-line.ts/wall-outline.ts:
 * positive `distance` moves the segment in the direction the segment's
 * own direction vector rotated +90 degrees (counter-clockwise) points -
 * this codebase's "left" - matching vector.ts's crossProduct and
 * polygon-area.ts's signedArea convention. A negative distance moves it
 * the other way; there is no separate "side" parameter here, unlike
 * wallFaceLine, since an offset tool's distance is naturally signed.
 *
 * Returns null (rather than a garbage segment) for the same degenerate
 * cases wallFaceLine already refuses: a zero-length (within tolerance)
 * input segment, or a non-finite/negative tolerance. Unlike
 * wallFaceLine, a zero distance is accepted and returns a copy of the
 * input segment unchanged - offsetting by nothing is well-defined, only
 * offsetting *from* nothing is not.
 */

import { normalizeVector, translatePoint, vector2, vectorBetween, vectorLength } from './vector';
import type { Segment } from './segment';

export function offsetSegment(
  segment: Segment,
  distance: number,
  tolerance: number,
): Segment | null {
  if (!Number.isFinite(distance) || !Number.isFinite(tolerance) || tolerance < 0) {
    return null;
  }
  const direction = vectorBetween(segment.start, segment.end);
  if (vectorLength(direction) <= tolerance) {
    return null;
  }
  const normalized = normalizeVector(direction);
  if (!normalized) {
    return null;
  }
  const left = vector2(-normalized.y, normalized.x);
  const offsetVector = vector2(left.x * distance, left.y * distance);
  return {
    start: translatePoint(segment.start, offsetVector),
    end: translatePoint(segment.end, offsetVector),
  };
}

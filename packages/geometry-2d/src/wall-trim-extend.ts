/**
 * ARQ-099: implement trim wall. ARQ-100: implement extend wall.
 *
 * Trim and extend share the same underlying operation: move one
 * endpoint of a wall's centerline to land exactly on a boundary line
 * (another wall's centerline, or one of its faces from wall-face-line.ts)
 * - what actually changes is only which direction that moves the
 * endpoint. projectEndpointOntoBoundary computes the new point (via
 * line-intersection.ts, since the boundary is treated as an infinite
 * line the same way join resolution does); classifyLengthChange then
 * reports whether applying it would shorten ('trimmed'), lengthen
 * ('extended'), or not move the endpoint at all - so a single primitive
 * serves both issues, each verified with its own test demonstrating the
 * direction it's meant to cover.
 *
 * Purely functional: this module never touches any project state,
 * committed or otherwise. Applying a computed point to an actual Wall
 * is the caller's job via an UpdateProperty operation (update-property-
 * operation.ts, ARQ-068) on the wall's `start`/`end` field - so "invalid
 * input leaves committed project state unchanged" holds trivially: an
 * invalid trim/extend returns null and nothing is ever committed.
 * Escape/Enter have no meaning at this layer either - there is no
 * preview/commit step inside a pure function; a tool built on top of
 * this (not built here, out of scope per this issue) would own that
 * interaction the same way wall-draw-tool.ts (ARQ-094) owns its own.
 */

import { lineIntersection } from './line-intersection';
import { pointsAreCoincident } from './tolerance';
import { vectorBetween, vectorLength } from './vector';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

export type WallEndpointName = 'start' | 'end';

/**
 * Computes where `endpoint` of `wall` would land on `boundary`'s
 * (infinite) line. Returns null if the wall and boundary are
 * parallel/degenerate (line-intersection.ts's own tolerance rules), or
 * if the result would collapse the wall to (within `tolerance` of) a
 * single point.
 */
export function projectEndpointOntoBoundary(
  wall: Segment,
  endpoint: WallEndpointName,
  boundary: Segment,
  tolerance: number,
): WorldPoint | null {
  const newPoint = lineIntersection(wall, boundary, tolerance);
  if (!newPoint) {
    return null;
  }
  const otherEnd = endpoint === 'start' ? wall.end : wall.start;
  if (pointsAreCoincident(newPoint, otherEnd, tolerance)) {
    return null;
  }
  return newPoint;
}

export type LengthChange = 'trimmed' | 'extended' | 'unchanged';

/** Whether replacing `endpoint` with `newPoint` would shorten, lengthen, or not change the wall's length. */
export function classifyLengthChange(
  wall: Segment,
  endpoint: WallEndpointName,
  newPoint: WorldPoint,
): LengthChange {
  const originalLength = vectorLength(vectorBetween(wall.start, wall.end));
  const otherEnd = endpoint === 'start' ? wall.end : wall.start;
  const newLength = vectorLength(vectorBetween(otherEnd, newPoint));
  if (newLength < originalLength) {
    return 'trimmed';
  }
  if (newLength > originalLength) {
    return 'extended';
  }
  return 'unchanged';
}

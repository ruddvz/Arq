/**
 * ARQ-095: implement butt join.
 *
 * A butt join: one wall (the "through" wall) stays a straight,
 * uninterrupted rectangle; the other (the "butting" wall) is trimmed so
 * its end lands exactly on the through wall's *near* face - the face on
 * whichever side the butting wall approaches from - rather than
 * poking through the through wall's centerline or falling short of it.
 *
 * The near face is picked automatically from which side of the through
 * wall's direction the butting wall's endpoint sits on (via
 * crossProduct's sign, the same left/right convention as
 * wall-outline.ts). Only the butting wall's centerline direction is
 * extended (via line-intersection.ts, ARQ-083's sibling) to meet that
 * face's infinite line - the through wall is never modified by this
 * function, matching "one wall continues, the other stops against it."
 *
 * Tolerance behaviour is explicit: null for a degenerate through-wall
 * centerline, a non-positive through-wall thickness, a butting wall
 * whose direction runs parallel to the through wall's face (no defined
 * trim point), or an invalid tolerance.
 */

import { crossProduct, vectorBetween } from './vector';
import { lineIntersection } from './line-intersection';
import { wallFaceLine, type WallAlignment } from './wall-face-line';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

export function buttJoinPoint(
  throughWall: Segment,
  throughThickness: number,
  throughAlignment: WallAlignment,
  buttingWallCenterline: Segment,
  tolerance: number,
): WorldPoint | null {
  const throughDirection = vectorBetween(throughWall.start, throughWall.end);
  const approachPoint = buttingWallCenterline.end;
  const toApproach = vectorBetween(throughWall.start, approachPoint);
  const side = crossProduct(throughDirection, toApproach) >= 0 ? 'left' : 'right';

  const nearFace = wallFaceLine(throughWall, throughThickness, throughAlignment, side, tolerance);
  if (!nearFace) {
    return null;
  }

  return lineIntersection(buttingWallCenterline, nearFace, tolerance);
}

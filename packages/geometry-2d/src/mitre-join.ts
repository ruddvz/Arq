/**
 * ARQ-096: implement mitre join.
 *
 * A mitre join: two walls sharing a corner, each with their own
 * thickness/alignment, both trimmed/extended so their matching-side
 * faces meet at a single shared point per side - unlike a butt join
 * (butt-join.ts, ARQ-095), where only one wall (the "butting" one) is
 * ever trimmed while the other stays untouched. Computed by
 * intersecting wall A's left face line with wall B's left face line
 * (and separately, the two right face lines) via line-intersection.ts.
 *
 * "Left"/"right" here name a side using vector.ts's counter-clockwise
 * convention, not "inner"/"outer" - which side of a real corner reads
 * as the visually inner vs outer mitre depends on which way the walls
 * turn at the corner, information this function does not have (the
 * same honesty as wall-outline.ts's interior/exterior caveat). A caller
 * that needs "inner"/"outer" specifically must work that out from the
 * walls' turn direction (e.g. the sign of crossProduct between the two
 * wall directions) and pick left or right accordingly.
 *
 * Either corner can independently be null (parallel faces on that side,
 * or a degenerate wall) without the other necessarily being null too.
 */

import { lineIntersection } from './line-intersection';
import { wallFaceLine, type WallAlignment } from './wall-face-line';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

export interface MitreCorners {
  readonly left: WorldPoint | null;
  readonly right: WorldPoint | null;
}

export function mitreJoinCorners(
  wallA: Segment,
  thicknessA: number,
  alignmentA: WallAlignment,
  wallB: Segment,
  thicknessB: number,
  alignmentB: WallAlignment,
  tolerance: number,
): MitreCorners {
  const leftA = wallFaceLine(wallA, thicknessA, alignmentA, 'left', tolerance);
  const leftB = wallFaceLine(wallB, thicknessB, alignmentB, 'left', tolerance);
  const rightA = wallFaceLine(wallA, thicknessA, alignmentA, 'right', tolerance);
  const rightB = wallFaceLine(wallB, thicknessB, alignmentB, 'right', tolerance);

  return {
    left: leftA && leftB ? lineIntersection(leftA, leftB, tolerance) : null,
    right: rightA && rightB ? lineIntersection(rightA, rightB, tolerance) : null,
  };
}

/**
 * ARQ-101: implement split wall.
 *
 * Splits one Wall into two at a point on its centerline: `first` keeps
 * the original wall's id, start point, and joinStart (that endpoint
 * never moved); `second` gets a caller-supplied new id, the split point
 * as its start, and the original wall's end point and joinEnd. Both
 * halves' new shared endpoint (the split point) gets joinEnd/joinStart
 * 'auto' respectively, since a new internal joint now exists there that
 * needs its own join resolution (butt-join.ts etc., ARQ-095-098) - it
 * cannot simply inherit either side of the original wall's own
 * (different) endpoint join intents.
 *
 * Known, documented gap: hostedOpeningIds is cleared on both halves
 * rather than distributed between them. Correctly assigning each
 * opening to whichever half it now falls on requires the opening's
 * offsetFromWallStart (relative to the *original* wall) compared
 * against the split point's own position along the wall - but Opening
 * is not modelled in this repository yet (the same gap noted for
 * hosted-opening invalidation when wall-instance.ts, ARQ-092, closed).
 * A caller must reassign hostedOpeningIds once Opening exists; silently
 * guessing a distribution here would be worse than an honest empty list.
 *
 * Purely functional and validates before returning: the split point
 * must lie on the wall's own centerline (within tolerance) and must not
 * coincide with either of the wall's existing endpoints (which would
 * produce a zero-length half) - returns null rather than a bogus split
 * for either case. Nothing here touches committed project state;
 * applying the result is the caller's job via DeleteElement + two
 * CreateElement operations (create-element-operation.ts, ARQ-067/069).
 * Escape/Enter have no meaning at this pure-function layer, the same as
 * wall-trim-extend.ts (ARQ-099/100).
 */

import { closestPointOnSegment, pointsAreCoincident } from '@arq/geometry-2d';
import type { WorldPoint } from '@arq/geometry-2d';
import type { WallId } from './ids';
import type { Wall } from './wall-instance';

export interface SplitWallResult {
  readonly first: Wall;
  readonly second: Wall;
}

export function splitWall(
  wall: Wall,
  splitPoint: WorldPoint,
  newSecondId: WallId,
  tolerance: number,
): SplitWallResult | null {
  const onCenterline = closestPointOnSegment({ start: wall.start, end: wall.end }, splitPoint);
  if (!pointsAreCoincident(onCenterline, splitPoint, tolerance)) {
    return null;
  }
  if (
    pointsAreCoincident(splitPoint, wall.start, tolerance) ||
    pointsAreCoincident(splitPoint, wall.end, tolerance)
  ) {
    return null;
  }

  const first: Wall = { ...wall, end: splitPoint, joinEnd: 'auto', hostedOpeningIds: [] };
  const second: Wall = {
    ...wall,
    id: newSecondId,
    start: splitPoint,
    joinStart: 'auto',
    hostedOpeningIds: [],
  };

  return { first, second };
}

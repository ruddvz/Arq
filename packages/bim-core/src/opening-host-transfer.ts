import { vectorBetween, vectorLength } from '@arq/geometry-2d';
import { length, toMillimetres } from './length';
import type { OpeningId, WallId } from './ids';
import type { Opening } from './opening';
import type { Wall } from './wall-instance';
import type { SplitWallResult } from './wall-split';

/**
 * V3-103 / AC3-048: openings keep a semantic host across a wall edit.
 *
 * `splitWall` (ARQ-101) clears `hostedOpeningIds` on both halves, and
 * `opening.ts` says why: an opening's offset is measured along the host wall's
 * centreline from its start, so it means nothing on a wall it no longer sits
 * on. Both modules then defer reassignment to "whatever command wires splitWall
 * into a live project". No such command existed, which means splitting a wall
 * today drops every door and window on it - precisely AC3-048's failure, an
 * opening that stops being hosted and becomes geometry with no semantic owner.
 *
 * This is that reassignment, and it is deterministic. Blueprint section 48 says
 * a split "assigns openings deterministically or asks the user"; the assignment
 * follows from the arithmetic for every opening that lies wholly on one side,
 * and there is nothing to ask about. What it refuses to do is guess about an
 * opening that straddles the split point. That opening cannot exist on either
 * half - it is longer than the space each leaves it - and the three ways to
 * make it fit are all worse than refusing: shortening it changes a door the
 * user did not change, sliding it puts a door somewhere nobody placed it, and
 * dropping it deletes one silently. So the whole split is blocked and the
 * straddling openings are named, which is something a surface can explain and a
 * user can act on.
 *
 * Comparing a wall's centreline - plain-number world coordinates - against an
 * opening's typed `Length` needs one unit assumption to bridge them. This takes
 * the same provisional stance `openingFitsWallLength` already takes, treating
 * world units as millimetres for that comparison only. ADR-0004 / D-014 remains
 * undecided and nothing here decides it.
 */

export interface OpeningAssignment {
  readonly openingId: OpeningId;
  readonly hostWallId: WallId;
  /** Re-measured from the new host's own start. */
  readonly offsetFromWallStart: Opening['offsetFromWallStart'];
}

export type OpeningTransferOutcome =
  | {
      readonly status: 'assigned';
      readonly first: Wall;
      readonly second: Wall;
      readonly assignments: readonly OpeningAssignment[];
    }
  | {
      readonly status: 'blocked';
      readonly reason: 'opening-straddles-split';
      /** Named so a message can say which door is in the way. */
      readonly straddlingOpeningIds: readonly OpeningId[];
    };

/**
 * Reassigns openings across a wall split.
 *
 * An opening that ends exactly at the split point stays on the first half, and
 * one that begins exactly there goes to the second. That matches
 * `openingFitsWallLength`, which already treats landing exactly on a boundary
 * as valid rather than as a failure; calling a boundary hit a straddle would
 * block splits that are geometrically fine.
 *
 * `toleranceMm` is required rather than defaulted, per ARQ-081: a hidden
 * epsilon here decides whether a door survives a split, and that is not a
 * decision to make out of the caller's sight.
 */
export function transferOpeningsAcrossSplit(
  original: Wall,
  split: SplitWallResult,
  openings: readonly Opening[],
  toleranceMm: number,
): OpeningTransferOutcome {
  const splitDistanceMm = vectorLength(vectorBetween(original.start, split.first.end));
  const hosted = openings.filter((opening) => opening.hostWallId === original.id);

  const straddling = hosted.filter((opening) => {
    const startMm = toMillimetres(opening.offsetFromWallStart);
    const endMm = startMm + toMillimetres(opening.width);
    return startMm < splitDistanceMm - toleranceMm && endMm > splitDistanceMm + toleranceMm;
  });

  if (straddling.length > 0) {
    return {
      status: 'blocked',
      reason: 'opening-straddles-split',
      straddlingOpeningIds: straddling.map((opening) => opening.id),
    };
  }

  const assignments: OpeningAssignment[] = [];
  const firstIds: OpeningId[] = [];
  const secondIds: OpeningId[] = [];

  for (const opening of hosted) {
    const startMm = toMillimetres(opening.offsetFromWallStart);
    const endMm = startMm + toMillimetres(opening.width);

    if (endMm <= splitDistanceMm + toleranceMm) {
      firstIds.push(opening.id);
      assignments.push({
        openingId: opening.id,
        hostWallId: split.first.id,
        // Unchanged: the first half shares the original's start point, so the
        // measurement it is taken from is the same one.
        offsetFromWallStart: opening.offsetFromWallStart,
      });
      continue;
    }

    secondIds.push(opening.id);
    assignments.push({
      openingId: opening.id,
      hostWallId: split.second.id,
      // Re-measured from the second half's own start, which is the split point.
      // Carrying the original offset across would place the opening one
      // split-distance too far along a wall that is that much shorter.
      offsetFromWallStart: length(startMm - splitDistanceMm, 'mm'),
    });
  }

  return {
    status: 'assigned',
    first: { ...split.first, hostedOpeningIds: firstIds },
    second: { ...split.second, hostedOpeningIds: secondIds },
    assignments,
  };
}

/**
 * Applies the assignments to the opening records themselves.
 *
 * Separate from the decision so a caller can present the plan before committing
 * to it. The wall halves and the openings have to change together or not at
 * all, and a function that did both would leave no point in between at which
 * the change could still be refused.
 */
export function applyOpeningAssignments(
  openings: readonly Opening[],
  assignments: readonly OpeningAssignment[],
): readonly Opening[] {
  const byId = new Map(assignments.map((assignment) => [assignment.openingId, assignment]));
  return openings.map((opening) => {
    const assignment = byId.get(opening.id);
    return assignment === undefined
      ? opening
      : {
          ...opening,
          hostWallId: assignment.hostWallId,
          offsetFromWallStart: assignment.offsetFromWallStart,
        };
  });
}

/**
 * Which openings a wall deletion would orphan.
 *
 * The other half of AC3-048. Deleting a host wall with doors in it is a real
 * intent - demolishing a wall demolishes what is in it - but it has to be a
 * stated one. `deletion-policy.ts` already decides what cascades; this answers
 * the question that policy needs an answer to, which is what is actually
 * attached, so nothing is discovered only after the wall is gone.
 */
export function openingsOrphanedByWallDeletion(
  wallId: WallId,
  openings: readonly Opening[],
): readonly OpeningId[] {
  return openings.filter((opening) => opening.hostWallId === wallId).map((opening) => opening.id);
}

/**
 * Openings that no longer sit within their host wall.
 *
 * Runs after any host edit that changes a wall's length - a trim, an extend, a
 * moved endpoint. `openingFitsWallLength` answers this for one opening; this
 * sweeps a set, so an edit that shortens a wall past its last door reports that
 * door rather than leaving it hanging off the end where nothing looks for it.
 */
export function openingsOutsideHost(
  wall: Wall,
  openings: readonly Opening[],
  toleranceMm: number,
): readonly OpeningId[] {
  const wallLengthMm = vectorLength(vectorBetween(wall.start, wall.end));
  return openings
    .filter((opening) => opening.hostWallId === wall.id)
    .filter((opening) => {
      const startMm = toMillimetres(opening.offsetFromWallStart);
      const endMm = startMm + toMillimetres(opening.width);
      return startMm < -toleranceMm || endMm > wallLengthMm + toleranceMm;
    })
    .map((opening) => opening.id);
}

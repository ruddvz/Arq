/**
 * Where a door leaf lies on its host wall.
 *
 * This is here, in the geometry package, rather than in either surface, because
 * both surfaces need the same answer and neither can be the one that owns it. A
 * plan draws the leaf as a line and the swing as an arc; a model extrudes the
 * leaf as a thin solid standing between the sill and the head. Those are
 * different drawings of one fact - the leaf runs from *this* hinge in *that*
 * direction - and when each surface derived that fact for itself, a change to
 * either one's hand or side convention moved the door in one view and not the
 * other. A door that opens left in plan and right in 3D is exactly the
 * plan/model disagreement neither view can show, so the derivation is shared and
 * the surfaces differ only in what they draw with it.
 *
 * Deliberately generic over plain numbers rather than over bim-core's `Opening`,
 * matching the boundary every other module in this package keeps.
 */

import { worldPoint, type WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

export interface DoorLeafInput {
  /** Distance along the host wall's centreline, from its start point. */
  readonly offsetFromWallStart: number;
  readonly width: number;
  /**
   * Which side of the wall the leaf swings to, looking along the wall from its
   * start point.
   */
  readonly side?: 'left' | 'right';
  /** Which end of the opening the leaf is hinged at. */
  readonly hand?: 'left' | 'right';
  /** Degrees, 0 to 180. Zero is a closed leaf lying in its own opening. */
  readonly swingAngle?: number;
}

export interface DoorLeafPlacement {
  /** The hinge, on the wall centreline at one end of the opening. */
  readonly hinge: WorldPoint;
  /** The free edge of the leaf, at `width` from the hinge. */
  readonly tip: WorldPoint;
  /** Radians, as `Math.atan2` measures: the leaf lying closed in its opening. */
  readonly closedAngle: number;
  /** Radians: the leaf swung by `swingAngle` to the side it opens towards. */
  readonly openAngle: number;
  /** True when the sweep from closed to open runs clockwise in world axes. */
  readonly clockwise: boolean;
}

/** Below this the wall has no direction and the opening no width. */
const MIN_LENGTH = 1e-6;

/** What a door with no stated hand, side or swing is drawn as. */
const DEFAULT_HAND = 'right';
const DEFAULT_SIDE = 'right';
const DEFAULT_SWING_DEGREES = 90;

/**
 * Places one leaf on one wall, or returns null when the wall has no length or
 * the opening no width - the same two degenerate inputs every other module here
 * refuses rather than dividing by.
 */
export function doorLeafPlacement(
  centreline: Segment,
  opening: DoorLeafInput,
): DoorLeafPlacement | null {
  const dx = centreline.end.x - centreline.start.x;
  const dy = centreline.end.y - centreline.start.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= MIN_LENGTH) return null;
  if (!Number.isFinite(opening.width) || opening.width <= MIN_LENGTH) return null;
  if (!Number.isFinite(opening.offsetFromWallStart)) return null;

  const ux = dx / length;
  const uy = dy / length;
  const a0 = opening.offsetFromWallStart;
  const a1 = a0 + opening.width;

  // The hinge sits at one end of the reveal, on the wall centreline. Putting it
  // on a face instead would set the leaf half a wall thickness away from the
  // point it turns about.
  const hingeAtStart = (opening.hand ?? DEFAULT_HAND) === 'left';
  const along = hingeAtStart ? a0 : a1;
  const hinge = worldPoint(centreline.start.x + ux * along, centreline.start.y + uy * along);

  // Closed, the leaf lies along the wall pointing from the hinge to the other
  // jamb. That is the zero of the sweep, and the swing is measured from it.
  const closedX = hingeAtStart ? ux : -ux;
  const closedY = hingeAtStart ? uy : -uy;
  const closedAngle = Math.atan2(closedY, closedX);

  // `side` is which way the leaf opens, looking along the wall from its start.
  // Left is towards the left-hand normal.
  //
  // The sweep's sign depends on the hand as well as the side, which is the part
  // that is easy to get wrong and was: a positive rotation only carries the leaf
  // towards the left-hand normal when it starts pointing along the wall. Hinge
  // it at the far jamb and it starts pointing back down the wall, so the same
  // positive rotation carries it to the *right*. Deciding the sign from `side`
  // alone made two doors that differ only in which jamb they hang from open to
  // opposite sides of the wall - which is not what `side` says, and the default
  // hand is the one it got wrong.
  const openingLeft = (opening.side ?? DEFAULT_SIDE) === 'left';
  const sweep = ((opening.swingAngle ?? DEFAULT_SWING_DEGREES) * Math.PI) / 180;
  const towardsLeftNormal = hingeAtStart ? sweep : -sweep;
  const signedSweep = openingLeft ? towardsLeftNormal : -towardsLeftNormal;
  const openAngle = closedAngle + signedSweep;

  return {
    hinge,
    tip: worldPoint(
      hinge.x + Math.cos(openAngle) * opening.width,
      hinge.y + Math.sin(openAngle) * opening.width,
    ),
    closedAngle,
    openAngle,
    clockwise: signedSweep < 0,
  };
}

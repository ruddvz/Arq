/**
 * What stands *in* an opening once the wall has been cut away from around it:
 * a door's leaf and a window's pane.
 *
 * `wall-opening-meshes.ts` makes the hole. It is deliberately only that - it
 * decomposes a wall into the panels that survive its openings, and a hole is all
 * a wall can contribute to a doorway. But a house whose every door and window is
 * an empty rectangle is not a model of that house; the ARQ House fixture has 26
 * doors and 13 windows, and until this module existed the 3D view showed 39
 * identical voids and no way to tell a door from a window from a bare structural
 * opening.
 *
 * Two thin solids, not joinery. A leaf is a slab the width of its opening; a
 * pane is a slab the width of its reveal, a third of the wall's thickness, from
 * sill to head. No frame, no mullions, no handle, no glazing bars - blueprint
 * section 62's plain treatment, and the same reasoning `plan-openings.ts` gives
 * for drawing a window as one band rather than as a detailed section. What these
 * two solids buy is the distinction the void cannot make: that this hole is
 * filled with glass and that one has a leaf hung in it.
 *
 * The leaf stands at the opening's own swing angle, which is the same angle the
 * plan draws it at, because both read `doorLeafPlacement` in `@arq/geometry-2d`.
 * A door shown closed in 3D and open in plan would be the plan/model
 * disagreement this repository keeps designing against, and the swing angle is
 * information the file actually carries - drawing every door closed would throw
 * it away.
 */

import { doorLeafPlacement, worldPoint, type Segment, type WorldPoint } from '@arq/geometry-2d';
import type { PlacedSolid } from './placed-solids';

export interface OpeningInfillInput {
  readonly id: string;
  readonly kind: 'door' | 'window' | 'void';
  /** Distance along the host wall's centreline, from its start point. */
  readonly offsetFromWallStart: number;
  readonly width: number;
  /** Height of the opening's underside above the level datum. */
  readonly sillHeight: number;
  readonly height: number;
  readonly side?: 'left' | 'right';
  readonly hand?: 'left' | 'right';
  readonly swingAngle?: number;
}

/** A leaf or a pane: a `PlacedSolid`, plus which of the two it is. */
export interface OpeningInfill extends PlacedSolid {
  readonly part: 'leaf' | 'pane';
  /**
   * The opening this fills. Carried rather than left for a caller to recover
   * from the solid's own id, because selection is a statement about the model
   * and picking a door's leaf should select the door, not a substring of a key.
   */
  readonly openingId: string;
}

/**
 * How thick a door leaf is drawn, in millimetres.
 *
 * A fixed 40mm rather than a fraction of the wall: a leaf is a manufactured
 * component and does not get thicker because it hangs in a thicker wall. 40mm is
 * a standard internal door; the error against a 44mm fire door is smaller than a
 * pixel at any camera distance the model is viewed from.
 */
const LEAF_THICKNESS_MM = 40;

/**
 * How much of the wall's thickness the glass occupies. The same third the plan
 * draws its pane at, so a window seen in plan and in section describes one
 * piece of glass and not two.
 */
const PANE_THICKNESS_FRACTION = 1 / 3;

/** Below this the opening is not a hole and its solid would be degenerate. */
const MIN_SIZE = 1e-6;

/**
 * The solid standing in one opening, or null when there is none to stand there.
 *
 * Null for a `void`, which is a hole with nothing in it and is drawn as exactly
 * that; and for the degenerate wall or opening every module in this package
 * refuses rather than dividing by.
 */
export function openingInfill(
  centreline: Segment,
  thickness: number,
  opening: OpeningInfillInput,
  /** The host level's datum, which the sill height is measured from. */
  baseElevation: number,
): OpeningInfill | null {
  if (opening.kind === 'void') return null;
  if (!Number.isFinite(thickness) || thickness <= MIN_SIZE) return null;
  if (!Number.isFinite(opening.height) || opening.height <= MIN_SIZE) return null;
  if (!Number.isFinite(opening.sillHeight) || !Number.isFinite(baseElevation)) return null;

  const outline =
    opening.kind === 'door'
      ? leafOutline(centreline, opening)
      : paneOutline(centreline, thickness, opening);
  if (outline === null) return null;

  const part = opening.kind === 'door' ? 'leaf' : 'pane';
  return {
    id: `${opening.id}-${part}`,
    part,
    openingId: opening.id,
    outline,
    baseElevation: baseElevation + opening.sillHeight,
    height: opening.height,
  };
}

/** The leaf's plan rectangle: its own width along the swing, its thickness across it. */
function leafOutline(
  centreline: Segment,
  opening: OpeningInfillInput,
): readonly WorldPoint[] | null {
  const placement = doorLeafPlacement(centreline, opening);
  if (placement === null) return null;

  // Along the leaf, and across it. The leaf is centred on the line the plan
  // draws, so the two views put its face in the same place rather than one
  // hanging the leaf beside where the other says the hinge is.
  const ux = Math.cos(placement.openAngle);
  const uy = Math.sin(placement.openAngle);
  const half = LEAF_THICKNESS_MM / 2;
  const at = (along: number, across: number): WorldPoint =>
    worldPoint(
      placement.hinge.x + ux * along - uy * across,
      placement.hinge.y + uy * along + ux * across,
    );
  return [at(0, half), at(opening.width, half), at(opening.width, -half), at(0, -half)];
}

/** The pane's plan rectangle: the reveal's width, a third of the wall's thickness. */
function paneOutline(
  centreline: Segment,
  thickness: number,
  opening: OpeningInfillInput,
): readonly WorldPoint[] | null {
  const dx = centreline.end.x - centreline.start.x;
  const dy = centreline.end.y - centreline.start.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= MIN_SIZE) return null;
  if (!Number.isFinite(opening.width) || opening.width <= MIN_SIZE) return null;
  if (!Number.isFinite(opening.offsetFromWallStart)) return null;

  const ux = dx / length;
  const uy = dy / length;
  const half = (thickness / 2) * PANE_THICKNESS_FRACTION;
  const a0 = opening.offsetFromWallStart;
  const a1 = a0 + opening.width;
  const at = (along: number, across: number): WorldPoint =>
    worldPoint(
      centreline.start.x + ux * along - uy * across,
      centreline.start.y + uy * along + ux * across,
    );
  return [at(a0, half), at(a1, half), at(a1, -half), at(a0, -half)];
}

/**
 * Every leaf and pane one wall hosts, dropping any that cannot be placed rather
 * than throwing: an unplaceable opening should cost its own leaf, not the whole
 * storey - the same rule `planOpeningsForWall` follows for the same reason.
 */
export function openingInfillsForWall(
  centreline: Segment,
  thickness: number,
  openings: readonly OpeningInfillInput[],
  baseElevation: number,
): readonly OpeningInfill[] {
  const placed: OpeningInfill[] = [];
  for (const opening of openings) {
    const infill = openingInfill(centreline, thickness, opening, baseElevation);
    if (infill !== null) placed.push(infill);
  }
  return placed;
}

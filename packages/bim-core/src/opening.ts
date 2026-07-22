/**
 * ARQ-103: define hosted opening.
 *
 * The shared Opening record a door (ARQ-104) or window instance hosts
 * itself through - blueprint section 48 ("Doors and windows create
 * hosted openings") and the `Opening` interface in the blueprint's
 * contracts appendix, reproduced here exactly (same duplication
 * rationale as ids.ts/wall-type.ts/wall-instance.ts: contracts/ is not
 * wired up as an importable package yet). `kind` distinguishes a door,
 * a window, or a bare void (an opening with no door/window instance
 * attached - e.g. an archway) at this shared layer; door/window-specific
 * properties (swing, hand, sill-normally-zero convention - blueprint
 * sections 46/47) belong to whichever instance references this
 * Opening's id, not to Opening itself.
 *
 * Position is measured the way sections 45/48 describe: offsetFromWallStart
 * is along the host wall's own centerline from its `start` point - the
 * same measurement wall-split.ts (ARQ-101) and offset-wall.ts (ARQ-102)
 * already flag as becoming meaningless the instant a wall is split or
 * offset (an opening's offset means nothing on a wall it no longer sits
 * on), which is why both of those clear hostedOpeningIds on their
 * results rather than guess how to carry an Opening across. Actually
 * distributing/reassigning openings on split ("wall split assigns
 * openings deterministically or asks the user", section 48) is
 * out of scope here - it is an editor-level decision belonging to
 * whatever command wires splitWall/offsetWall into a live project, not
 * this record's definition.
 *
 * Validation (blueprint section 48's rules): openingFitsWallLength
 * checks "opening cannot extend beyond host" and openingFitsWallHeight
 * checks "opening cannot exceed host height" (using
 * effectiveWallHeight, wall-instance.ts, ARQ-092, so an overridden wall
 * height is respected the same way it is everywhere else). Comparing a
 * wall's centerline (a plain-number WorldPoint distance, geometry-2d -
 * ADR-0004/D-014 still undecided) against a typed Length requires *a*
 * unit assumption to bridge them; both functions treat world-space
 * units as millimetres for that one comparison - the same provisional
 * stance already taken wherever a Length's toMillimetres() value is
 * passed into a geometry-2d plain-number parameter (e.g. wall-outline.ts's
 * thickness) - not a claim that D-014 is resolved.
 *
 * Overlap checking (ARQ-109): openingsOverlap/findOverlappingOpenings
 * implement section 48's "overlaps are blocking by default" - two
 * openings only overlap when they share a hostWallId AND their
 * [offset, offset + width] spans actually intersect; two openings that
 * merely touch end-to-end (section 42's "two openings touching"
 * adversarial case) are deliberately not flagged, matching how
 * openingFitsWallLength already treats landing exactly on a boundary as
 * valid rather than a failure. Turning an overlap into a user-facing
 * ValidationMessage and wiring that into a real create/move operation
 * is out of scope here (that needs @arq/operations's ValidationMessage,
 * and bim-core does not depend on operations - the reverse is true) -
 * this module only defines the pure predicate.
 */

import { vectorBetween, vectorLength } from '@arq/geometry-2d';
import { toMillimetres, type Length } from './length';
import type { OpeningId, WallId } from './ids';
import { effectiveWallHeight, type Wall } from './wall-instance';
import type { WallType } from './wall-type';

export type OpeningKind = 'door' | 'window' | 'void';

export interface Opening {
  readonly id: OpeningId;
  readonly hostWallId: WallId;
  readonly kind: OpeningKind;
  readonly offsetFromWallStart: Length;
  readonly width: Length;
  readonly sillHeight: Length;
  readonly height: Length;
}

export interface CreateOpeningInput {
  readonly id: OpeningId;
  readonly hostWallId: WallId;
  readonly kind: OpeningKind;
  readonly offsetFromWallStart: Length;
  readonly width: Length;
  readonly sillHeight: Length;
  readonly height: Length;
}

/** What changing an Opening's own placement or size invalidates downstream - see this module's doc comment. */
export const OPENING_DERIVED_INVALIDATIONS = [
  'wall-opening-cut',
  'dimensions',
  'plan-render-cache',
  'mesh-3d',
] as const;

/** Constructs an Opening, rejecting a non-positive width/height or a negative sillHeight/offsetFromWallStart. */
export function createOpening(input: CreateOpeningInput): Opening {
  if (!Number.isFinite(input.width.value) || input.width.value <= 0) {
    throw new RangeError('width must be a positive finite length');
  }
  if (!Number.isFinite(input.height.value) || input.height.value <= 0) {
    throw new RangeError('height must be a positive finite length');
  }
  if (!Number.isFinite(input.sillHeight.value) || input.sillHeight.value < 0) {
    throw new RangeError('sillHeight must be a non-negative finite length');
  }
  if (
    !Number.isFinite(input.offsetFromWallStart.value) ||
    input.offsetFromWallStart.value < 0
  ) {
    throw new RangeError('offsetFromWallStart must be a non-negative finite length');
  }
  return {
    id: input.id,
    hostWallId: input.hostWallId,
    kind: input.kind,
    offsetFromWallStart: input.offsetFromWallStart,
    width: input.width,
    sillHeight: input.sillHeight,
    height: input.height,
  };
}

/** Section 48: "opening cannot extend beyond host" - true if the opening's span stays within the host wall's centerline length. */
export function openingFitsWallLength(opening: Opening, wall: Wall, toleranceMm = 1e-6): boolean {
  const wallLengthMm = vectorLength(vectorBetween(wall.start, wall.end));
  const openingEndMm = toMillimetres(opening.offsetFromWallStart) + toMillimetres(opening.width);
  return openingEndMm <= wallLengthMm + toleranceMm;
}

/** Section 48: "opening cannot exceed host height" - true if the opening's sill-to-head span stays within the host wall's effective height. */
export function openingFitsWallHeight(
  opening: Opening,
  wall: Wall,
  wallType: WallType,
  toleranceMm = 1e-6,
): boolean {
  const wallHeightMm = toMillimetres(effectiveWallHeight(wall, wallType));
  const openingTopMm = toMillimetres(opening.sillHeight) + toMillimetres(opening.height);
  return openingTopMm <= wallHeightMm + toleranceMm;
}

/**
 * Section 48: "overlaps are blocking by default" - true when `a` and `b`
 * host on the same wall and their spans along its centerline actually
 * intersect. Two openings on different walls never overlap. Two
 * openings that only touch end-to-end (offset + width of one equals
 * the other's offset, within tolerance) are not overlapping - this is
 * section 42's "two openings touching" adversarial case, which must be
 * accepted, not blocked.
 */
export function openingsOverlap(a: Opening, b: Opening, toleranceMm = 1e-6): boolean {
  if (a.hostWallId !== b.hostWallId) {
    return false;
  }
  const aStartMm = toMillimetres(a.offsetFromWallStart);
  const aEndMm = aStartMm + toMillimetres(a.width);
  const bStartMm = toMillimetres(b.offsetFromWallStart);
  const bEndMm = bStartMm + toMillimetres(b.width);
  return aStartMm < bEndMm - toleranceMm && bStartMm < aEndMm - toleranceMm;
}

/** Every pair (by reference, not index) among `openings` for which openingsOverlap is true - only ever compares openings that share a hostWallId. */
export function findOverlappingOpenings(
  openings: readonly Opening[],
  toleranceMm = 1e-6,
): readonly (readonly [Opening, Opening])[] {
  const pairs: (readonly [Opening, Opening])[] = [];
  for (let i = 0; i < openings.length; i += 1) {
    for (let j = i + 1; j < openings.length; j += 1) {
      const a = openings[i]!;
      const b = openings[j]!;
      if (openingsOverlap(a, b, toleranceMm)) {
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

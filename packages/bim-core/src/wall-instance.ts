/**
 * ARQ-092: define wall instance.
 *
 * A single wall placed in a project: its reference line, level,
 * alignment, per-endpoint join intent, and hosted openings - the
 * instance-owned half of blueprint section 45's "Authoritative
 * definition" (the type-owned half, thickness/defaultHeight/function,
 * is wall-type.ts, ARQ-091). Mirrors contracts/model.ts's existing Wall
 * shape (same duplication rationale as ids.ts/level.ts), with `start`/
 * `end` typed as @arq/geometry-2d's WorldPoint (ARQ-032) rather than a
 * naked {x,y}, and heightOverride as bim-core's Length (ARQ-059).
 *
 * Type-instance behaviour, concretely: resolveWallHeight below is the
 * actual reading-through-to-the-type behaviour PropertyState
 * (property-state.ts, ARQ-064) exists to represent - a wall's effective
 * height is Overridden (reading heightOverride) when set, or Inherited
 * (reading the type's defaultHeight) when not, and resolveOverride
 * (ARQ-064) is what "reset override" on a wall's height means: it goes
 * back to reading the type's *current* defaultHeight, not a frozen
 * snapshot of what that value was when heightOverride was originally set.
 *
 * Stable IDs: WallId (ARQ-060) never changes for the life of the wall,
 * including across reversing its endpoints (section 45's "unexpected
 * flipping when reversing endpoints" bug) - swapping start/end is a
 * property update (ARQ-068's UpdateProperty), not a delete-and-recreate,
 * so hostedOpeningIds and every reference to this wall's id remain valid.
 *
 * Derived invalidations: moving a wall (changing start/end),
 * reassigning its typeId, or changing its alignment/heightOverride all
 * invalidate the same set wall-type.ts declares
 * (WALL_TYPE_DERIVED_INVALIDATIONS) plus, per section 36, hosted
 * opening positions (since Opening.offsetFromWallStart, not yet
 * modelled in this repository, is measured along the wall).
 */

import type { WorldPoint } from '@arq/geometry-2d';
import type { Length } from './length';
import {
  hasValue,
  inheritedProperty,
  overriddenProperty,
  type PropertyState,
} from './property-state';
import type { LevelId, OpeningId, WallId, WallTypeId } from './ids';
import type { WallType } from './wall-type';

export type WallAlignment = 'centre' | 'interior' | 'exterior';
export type WallJoinIntent = 'auto' | 'butt' | 'mitre' | 'disallow';

export interface Wall {
  readonly id: WallId;
  readonly typeId: WallTypeId;
  readonly levelId: LevelId;
  readonly start: WorldPoint;
  readonly end: WorldPoint;
  readonly alignment: WallAlignment;
  readonly heightOverride?: Length;
  readonly joinStart: WallJoinIntent;
  readonly joinEnd: WallJoinIntent;
  readonly hostedOpeningIds: readonly OpeningId[];
}

export interface CreateWallInput {
  readonly id: WallId;
  readonly typeId: WallTypeId;
  readonly levelId: LevelId;
  readonly start: WorldPoint;
  readonly end: WorldPoint;
  readonly alignment?: WallAlignment;
  readonly heightOverride?: Length;
  readonly joinStart?: WallJoinIntent;
  readonly joinEnd?: WallJoinIntent;
}

export function createWall(input: CreateWallInput): Wall {
  const wall: Wall = {
    id: input.id,
    typeId: input.typeId,
    levelId: input.levelId,
    start: input.start,
    end: input.end,
    alignment: input.alignment ?? 'centre',
    joinStart: input.joinStart ?? 'auto',
    joinEnd: input.joinEnd ?? 'auto',
    hostedOpeningIds: [],
  };
  return input.heightOverride === undefined
    ? wall
    : { ...wall, heightOverride: input.heightOverride };
}

/** The wall's effective height as a PropertyState: Overridden when heightOverride is set, Inherited (from the type's defaultHeight) otherwise. */
export function resolveWallHeight(wall: Wall, wallType: WallType): PropertyState<Length> {
  return wall.heightOverride === undefined
    ? inheritedProperty(wallType.defaultHeight, wallType.id)
    : overriddenProperty(wall.heightOverride, wallType.id);
}

/** "Reset override" for a wall's height: clears heightOverride, so it goes back to reading the type's current defaultHeight - not a frozen snapshot of it. */
export function resetWallHeightOverride(wall: Wall): Wall {
  if (wall.heightOverride === undefined) {
    return wall;
  }
  const { heightOverride: _drop, ...rest } = wall;
  return rest;
}

/** The wall's effective height value as a plain Length, regardless of whether it's inherited or overridden - for callers that just need the number, not the provenance. */
export function effectiveWallHeight(wall: Wall, wallType: WallType): Length {
  const state = resolveWallHeight(wall, wallType);
  if (!hasValue(state)) {
    throw new Error(
      'resolveWallHeight must always return a value-bearing state (inherited or overridden)',
    );
  }
  return state.value;
}

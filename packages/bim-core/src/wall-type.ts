/**
 * ARQ-091: define wall type.
 *
 * The shared, reusable definition a Wall instance points to (blueprint
 * section 45's "Authoritative definition" list splits a wall into what
 * the type owns - thickness, default height, function - versus what an
 * instance owns - its reference line, level, alignment, join intent,
 * hosted openings). Mirrors contracts/model.ts's existing WallType
 * shape, same duplication rationale as ids.ts/level.ts (contracts/ isn't
 * wired up as an importable package yet).
 *
 * thickness/defaultHeight are bim-core's own Length (ARQ-059), not a
 * naked number - directly satisfying blueprint section 34's "typed
 * units; no naked numbers in core APIs" requirement, an upgrade over
 * contracts/model.ts's plain-number fields (that file predates the
 * typed unit library).
 *
 * Stable IDs / type-instance behaviour: WallTypeId (ARQ-060) is the
 * stable handle every Wall instance's typeId field (ARQ-092) resolves
 * through - changing a WallType's thickness or height changes every
 * wall of that type without touching a single Wall instance record,
 * which is exactly the point of the type/instance split (blueprint
 * section 35, PropertyState in property-state.ts, ARQ-064).
 *
 * Derived invalidations: per blueprint section 36, changing a
 * WallType's thickness invalidates every wall of that type's outline
 * (wall-outline.ts, ARQ-093), room boundaries touching those walls, and
 * downstream dimensions/render caches - this module does not compute
 * that invalidation set itself (it has no notion of "which walls use
 * this type", that lookup belongs to whatever holds the full element
 * list), but `WALL_TYPE_DERIVED_INVALIDATIONS` names what a caller must
 * invalidate when a WallType changes, so the obligation is declared
 * rather than left implicit.
 */

import type { Length } from './length';
import type { WallTypeId } from './ids';

export type WallFunction = 'exterior' | 'interior' | 'unknown';

export interface WallType {
  readonly id: WallTypeId;
  readonly name: string;
  readonly thickness: Length;
  readonly defaultHeight: Length;
  readonly function: WallFunction;
}

/** What changing a WallType invalidates downstream - see this module's doc comment. */
export const WALL_TYPE_DERIVED_INVALIDATIONS = [
  'wall-outline',
  'room-boundary',
  'dimensions',
  'plan-render-cache',
  'mesh-3d',
] as const;

export interface CreateWallTypeInput {
  readonly id: WallTypeId;
  readonly name: string;
  readonly thickness: Length;
  readonly defaultHeight: Length;
  readonly function?: WallFunction;
}

/** Constructs a WallType, rejecting a non-positive thickness or height. */
export function createWallType(input: CreateWallTypeInput): WallType {
  if (!Number.isFinite(input.thickness.value) || input.thickness.value <= 0) {
    throw new RangeError('thickness must be a positive finite length');
  }
  if (!Number.isFinite(input.defaultHeight.value) || input.defaultHeight.value <= 0) {
    throw new RangeError('defaultHeight must be a positive finite length');
  }
  return {
    id: input.id,
    name: input.name,
    thickness: input.thickness,
    defaultHeight: input.defaultHeight,
    function: input.function ?? 'unknown',
  };
}

import type { Length } from './length';
import type { LevelId, MaterialId, SlabId, SlabTypeId } from './ids';

/**
 * V3-081: floors and roofs, following the same type/instance split as walls.
 *
 * The split matters for the same reason it does there: changing a slab type's
 * thickness changes every slab of that type without touching a single instance
 * record. What differs is where the datum sits, and that is the one thing worth
 * getting right up front.
 *
 * A slab is positioned by a level plus an offset, and the offset is measured to
 * a named face rather than to "the slab". A 200mm floor whose *top* is at level
 * datum and one whose *bottom* is at level datum occupy different space, and
 * every downstream question - does this wall reach the floor, what is the clear
 * ceiling height, does this stair land correctly - depends on which was meant.
 * Storing an offset without saying what it measures to leaves that ambiguity in
 * the data, where it becomes a per-caller guess.
 */

export type SlabFunction = 'floor' | 'roof' | 'ceiling' | 'unknown';

/**
 * Which face of the slab sits at the level datum plus offset.
 *
 * `top` is the default in most architectural drafting, because a level datum is
 * usually finished floor level, but defaulting is not the same as assuming: the
 * field is required so a caller states it.
 */
export type SlabDatumFace = 'top' | 'bottom';

export interface SlabType {
  readonly id: SlabTypeId;
  readonly name: string;
  readonly thickness: Length;
  readonly function: SlabFunction;
  /** The type's default material. An instance may override it. */
  readonly materialId?: MaterialId;
}

export interface SlabInstance {
  readonly id: SlabId;
  readonly typeId: SlabTypeId;
  readonly levelId: LevelId;
  /**
   * Distance from the level datum to `datumFace`. Signed: a floor slab hung
   * below its level has a negative offset, and forcing it positive would mean
   * either a wrong position or a second field to say "but downwards".
   */
  readonly offsetFromLevel: Length;
  readonly datumFace: SlabDatumFace;
  /**
   * The slab's outline, as a closed boundary of stable references or points.
   * Held as an opaque id list here: the geometry itself belongs to the plan
   * model, and duplicating it in the semantic record would create two outlines
   * that can disagree.
   */
  readonly boundaryIds: readonly string[];
  /** Overrides the type's material for this instance only. */
  readonly materialId?: MaterialId;
}

/**
 * What changing a SlabType invalidates. Declared rather than computed, matching
 * `WALL_TYPE_DERIVED_INVALIDATIONS`: this module cannot know which slabs use a
 * type, and pretending to would put that lookup in the wrong place.
 */
export const SLAB_TYPE_DERIVED_INVALIDATIONS = [
  'slab-solid',
  'room-volume',
  'section-profile',
  'quantity-schedule',
] as const;

export function slabType(input: SlabType): SlabType {
  return input;
}

export function slabInstance(input: SlabInstance): SlabInstance {
  return input;
}

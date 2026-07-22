/**
 * ARQ-104: define door type and instance (type half).
 *
 * The shared, reusable definition a Door instance (door-instance.ts)
 * points to - blueprint section 46 lists "type" as one of a door's own
 * properties, alongside width/height/host/offset/side/hand/swing
 * angle/sill/level; the type-owned/instance-owned split mirrors
 * WallType/Wall (wall-type.ts, ARQ-091): defaultWidth/defaultHeight are
 * the catalog defaults a new door of this type is created with, while
 * the instance-owned width/height of an already-placed door lives on
 * its Opening (opening.ts, ARQ-103), not on the Door instance itself -
 * see door-instance.ts's doc comment for why.
 *
 * No contracts/model.ts counterpart exists for this (that file predates
 * the door type/instance split), so this is a new declaration by
 * extension of the WallType/Wall pattern rather than a mirror of
 * existing prior art, unlike ids.ts/wall-type.ts/opening.ts.
 */

import type { Length } from './length';
import type { DoorTypeId } from './ids';

export interface DoorType {
  readonly id: DoorTypeId;
  readonly name: string;
  readonly defaultWidth: Length;
  readonly defaultHeight: Length;
}

/** What changing a DoorType's defaults invalidates downstream - see this module's doc comment. Only affects future doors created from this type; existing Openings already hold their own concrete width/height. */
export const DOOR_TYPE_DERIVED_INVALIDATIONS = [
  'dimensions',
  'plan-render-cache',
  'mesh-3d',
] as const;

export interface CreateDoorTypeInput {
  readonly id: DoorTypeId;
  readonly name: string;
  readonly defaultWidth: Length;
  readonly defaultHeight: Length;
}

/** Constructs a DoorType, rejecting a non-positive defaultWidth or defaultHeight. */
export function createDoorType(input: CreateDoorTypeInput): DoorType {
  if (!Number.isFinite(input.defaultWidth.value) || input.defaultWidth.value <= 0) {
    throw new RangeError('defaultWidth must be a positive finite length');
  }
  if (!Number.isFinite(input.defaultHeight.value) || input.defaultHeight.value <= 0) {
    throw new RangeError('defaultHeight must be a positive finite length');
  }
  return {
    id: input.id,
    name: input.name,
    defaultWidth: input.defaultWidth,
    defaultHeight: input.defaultHeight,
  };
}

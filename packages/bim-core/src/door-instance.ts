/**
 * ARQ-104: define door type and instance (instance half).
 *
 * A single door placed in a project, hosted through an Opening
 * (opening.ts, ARQ-103). Blueprint section 46 lists a door's properties
 * as: type, width, height, host, offset, side, hand, swing angle for
 * display, sill (normally zero), level, mark (later). host/offset/
 * width/height/sill are already Opening's fields (Opening.hostWallId,
 * .offsetFromWallStart, .width, .height, .sillHeight) - a Door does not
 * duplicate them. That leaves typeId, openingId (the "host" link, one
 * level of indirection through Opening rather than straight to WallId,
 * since the door's physical footprint is the Opening's job), levelId,
 * side, hand and swingAngle as this instance's own fields. `mark` is
 * explicitly "later" per the blueprint and is not included.
 *
 * Type-instance behaviour, concretely: unlike Wall's heightOverride
 * (an optional field with an explicit "unset" state), a placed door's
 * Opening always holds a concrete width/height - there is no separate
 * "instance override" flag to store, because the Opening itself
 * already *is* the one physical record of what was actually placed.
 * resolveDoorWidth/resolveDoorHeight below give the same
 * inherited-vs-overridden read that resolveWallHeight (wall-instance.ts)
 * gives, but by comparison rather than by a stored flag: a door whose
 * Opening still matches its DoorType's current default is Inherited;
 * one that was placed or later resized away from that default is
 * Overridden. Both states carry the DoorType's id as sourceTypeId, the
 * same PropertyState (property-state.ts, ARQ-064) contract used
 * throughout.
 *
 * Stable IDs: DoorId (ids.ts, ARQ-104) never changes for the life of
 * the door, including flipSide/flipHand below (property updates, not
 * delete-and-recreate) - same rationale as WallId surviving endpoint
 * reversal (wall-instance.ts).
 *
 * Derived invalidations: flipping side or hand changes which way the
 * door reads on plan and which face of the wall it swings into, so both
 * invalidate the same render/dimension set DOOR_TYPE_DERIVED_INVALIDATIONS
 * (door-type.ts) already declares for a type-level default change -
 * reused here rather than re-declared, since the affected downstream
 * set is identical.
 *
 * Placing a door (constructing its Opening from a DoorType's defaults,
 * choosing a host wall and offset, snapping, etc.) is ARQ-105's job,
 * not this module's - this module only defines the record and its own
 * property updates.
 */

import type { DoorId, DoorTypeId, LevelId, OpeningId } from './ids';
import type { Length } from './length';
import { lengthsAreEqual } from './length';
import type { Opening } from './opening';
import { inheritedProperty, overriddenProperty, type PropertyState } from './property-state';
import type { DoorType } from './door-type';

export type DoorSide = 'left' | 'right';
export type DoorHand = 'left' | 'right';

export interface Door {
  readonly id: DoorId;
  readonly typeId: DoorTypeId;
  readonly openingId: OpeningId;
  readonly levelId: LevelId;
  readonly side: DoorSide;
  readonly hand: DoorHand;
  readonly swingAngle: number;
}

export interface CreateDoorInput {
  readonly id: DoorId;
  readonly typeId: DoorTypeId;
  readonly openingId: OpeningId;
  readonly levelId: LevelId;
  readonly side?: DoorSide;
  readonly hand?: DoorHand;
  readonly swingAngle?: number;
}

const DEFAULT_SWING_ANGLE = 90;

/** Constructs a Door, defaulting side/hand to 'right' and swingAngle to 90 degrees. Rejects a swingAngle outside (0, 180]. */
export function createDoor(input: CreateDoorInput): Door {
  const swingAngle = input.swingAngle ?? DEFAULT_SWING_ANGLE;
  if (!Number.isFinite(swingAngle) || swingAngle <= 0 || swingAngle > 180) {
    throw new RangeError('swingAngle must be a finite number in the range (0, 180] degrees');
  }
  return {
    id: input.id,
    typeId: input.typeId,
    openingId: input.openingId,
    levelId: input.levelId,
    side: input.side ?? 'right',
    hand: input.hand ?? 'right',
    swingAngle,
  };
}

/** Section 46's "flip side" interaction: swaps which face of the host wall the door swings toward. */
export function flipSide(door: Door): Door {
  return { ...door, side: door.side === 'left' ? 'right' : 'left' };
}

/** Section 46's "flip hand" interaction: swaps which jamb the hinge is mounted on. */
export function flipHand(door: Door): Door {
  return { ...door, hand: door.hand === 'left' ? 'right' : 'left' };
}

/** The door's effective width as a PropertyState: Inherited while its Opening's width still matches the DoorType's current default, Overridden once it doesn't. */
export function resolveDoorWidth(door: Door, doorType: DoorType, opening: Opening): PropertyState<Length> {
  return lengthsAreEqual(opening.width, doorType.defaultWidth)
    ? inheritedProperty(doorType.defaultWidth, doorType.id)
    : overriddenProperty(opening.width, doorType.id);
}

/** The door's effective height as a PropertyState: Inherited while its Opening's height still matches the DoorType's current default, Overridden once it doesn't. */
export function resolveDoorHeight(door: Door, doorType: DoorType, opening: Opening): PropertyState<Length> {
  return lengthsAreEqual(opening.height, doorType.defaultHeight)
    ? inheritedProperty(doorType.defaultHeight, doorType.id)
    : overriddenProperty(opening.height, doorType.id);
}

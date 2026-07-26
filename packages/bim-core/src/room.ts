/**
 * ARQ-110: define room schema.
 *
 * Mirrors contracts/model.ts's existing Room shape (same duplication
 * rationale as ids.ts/wall-type.ts/wall-instance.ts/opening.ts:
 * contracts/ is not wired up as an importable workspace package yet),
 * with two deliberate upgrades over that file, matching the same kind
 * of upgrade wall-instance.ts already made over contracts/model.ts's
 * plain Point2:
 *
 * - seedPoint/calculatedBoundary use geometry-2d's WorldPoint (ARQ-032)
 *   rather than a naked {x,y}. A room boundary is exactly the "single
 *   ring of points" shape polygon-area.ts (ARQ-085) already treats as
 *   a plain `readonly WorldPoint[]` - there is no separate Polygon2
 *   type in this codebase to mirror, so Room does not invent one.
 * - `status` uses blueprint section 49's full six-value list (valid,
 *   not-enclosed, overlapping, too-small, invalid-polygon, stale)
 *   rather than contracts/model.ts's narrower four-value stub (that
 *   file's own appendix predates section 49's fuller "Status" list) -
 *   a superset of the same four concepts, not a contradiction of them.
 *
 * calculatedArea stays a plain number (not a typed Length-like "Area"
 * unit): the blueprint's own contracts/model.ts already stores it as a
 * plain number, and introducing a typed area-unit library is a
 * separate, larger concern (parallel to how ARQ-059 was its own issue
 * for Length) that this schema-definition issue's non-goals ("do not
 * expand into later release scope") explicitly rule out inventing here.
 *
 * Unlike Wall/Door/Window, Room has no RoomType: the blueprint's own
 * Room interface has no typeId field, and section 49 never describes a
 * reusable room "type" a Room instance inherits defaults from - so
 * there is no type-instance PropertyState split to implement here.
 * "Stable IDs and type-instance behaviour are preserved" is upheld by
 * RoomId (ids.ts, ARQ-060) never changing across a Room's own property
 * updates, and by *not* fabricating an inheritance relationship the
 * blueprint does not describe.
 *
 * Computing a room's actual boundaryElementIds/calculatedBoundary/
 * calculatedArea (the room-boundary graph walk, ARQ-111; the area
 * calculation itself, ARQ-114) and the "click within an enclosed
 * boundary" placement workflow (ARQ-112) are all separate, later
 * issues - this module only defines the record shape and the one
 * structural sanity check createRoom can make without any of that
 * machinery: a room reported as 'valid' must actually have a boundary
 * (at least 3 points; anything less is not a polygon at all).
 */

import type { ElementId, LevelId, RoomId } from './ids';
import type { WorldPoint } from '@arq/geometry-2d';

export type RoomStatus =
  'valid' | 'not-enclosed' | 'overlapping' | 'too-small' | 'invalid-polygon' | 'stale';

export interface Room {
  readonly id: RoomId;
  readonly levelId: LevelId;
  readonly seedPoint: WorldPoint;
  readonly name: string;
  readonly number?: string;
  readonly boundaryElementIds: readonly ElementId[];
  readonly calculatedBoundary: readonly WorldPoint[];
  readonly calculatedArea: number;
  readonly status: RoomStatus;
}

/** What a Room's own boundary/area/status changing invalidates downstream - see this module's doc comment. */
export const ROOM_DERIVED_INVALIDATIONS = [
  'calculated-boundary',
  'calculated-area',
  'room-label',
  'plan-render-cache',
] as const;

export interface CreateRoomInput {
  readonly id: RoomId;
  readonly levelId: LevelId;
  readonly seedPoint: WorldPoint;
  readonly name: string;
  readonly number?: string;
  readonly boundaryElementIds: readonly ElementId[];
  readonly calculatedBoundary: readonly WorldPoint[];
  readonly calculatedArea: number;
  readonly status: RoomStatus;
}

/**
 * Constructs a Room, rejecting a non-finite/negative calculatedArea and
 * rejecting a 'valid' status paired with a calculatedBoundary of fewer
 * than 3 points (not a polygon at all - the one degenerate combination
 * this schema alone can catch, without running any actual boundary
 * computation).
 */
export function createRoom(input: CreateRoomInput): Room {
  if (!Number.isFinite(input.calculatedArea) || input.calculatedArea < 0) {
    throw new RangeError('calculatedArea must be a non-negative finite number');
  }
  if (input.status === 'valid' && input.calculatedBoundary.length < 3) {
    throw new RangeError(
      "a room with status 'valid' must have a calculatedBoundary of at least 3 points",
    );
  }
  const room: Room = {
    id: input.id,
    levelId: input.levelId,
    seedPoint: input.seedPoint,
    name: input.name,
    boundaryElementIds: [...input.boundaryElementIds],
    calculatedBoundary: [...input.calculatedBoundary],
    calculatedArea: input.calculatedArea,
    status: input.status,
  };
  return input.number === undefined ? room : { ...room, number: input.number };
}

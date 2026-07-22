/**
 * ARQ-138: implement room label.
 *
 * Blueprint section 49 ("Rooms")'s First workflow ends with "assign
 * name; calculate area; display room label" - this module is that last
 * step, turning a room's already-known name/number/area into the
 * PlanTextPrimitive (plan-scene.ts, ARQ-119) a renderer draws.
 *
 * Anchored at the room's seedPoint rather than a computed polygon
 * centroid: seedPoint is the click that placed the room (room-
 * placement-tool.ts, ARQ-112), so it is guaranteed to already be inside
 * the room's boundary (point-in-polygon.ts, ARQ-111 is what made that
 * placement possible in the first place) - a geometric centroid has no
 * such guarantee for a concave room and would need new machinery this
 * issue's "do not expand into later release scope" non-goal rules out
 * inventing.
 *
 * RoomLabelSource mirrors Room's own name/number/calculatedArea fields
 * (room.ts, ARQ-110) by value, not by import - the same "redeclare
 * structurally, don't import bim-core" boundary snap-glyph-rendering.ts
 * (ARQ-122) and every other plan-renderer module already keeps.
 *
 * Label text is two lines - name (with number prefixed, when present)
 * on the first, formatted area on the second - a plain, honest choice
 * among several a finished design could make; text layout/wrapping
 * itself is a renderer backend concern (line-weight.ts, ARQ-120,
 * established the same split for stroke rendering), not this module's.
 */

import type { WorldPoint } from '@arq/geometry-2d';
import type { PlanTextPrimitive } from './plan-scene';

export interface RoomLabelSource<TId> {
  readonly elementId: TId;
  readonly seedPoint: WorldPoint;
  readonly name: string;
  readonly number?: string;
  readonly areaSquareMetres: number;
}

/** "Room name" or "number Room name" (section 49 gives no separator convention of its own, so a single space is used). */
export function roomLabelNameLine<TId>(source: Pick<RoomLabelSource<TId>, 'name' | 'number'>): string {
  return source.number === undefined ? source.name : `${source.number} ${source.name}`;
}

/** Area formatted to one decimal place, in square metres - matching room-area.ts's (ARQ-114) own unit. */
export function roomLabelAreaLine<TId>(source: Pick<RoomLabelSource<TId>, 'areaSquareMetres'>): string {
  return `${source.areaSquareMetres.toFixed(1)} m²`;
}

export function roomLabelText<TId>(source: RoomLabelSource<TId>): string {
  return `${roomLabelNameLine(source)}\n${roomLabelAreaLine(source)}`;
}

/** Builds the room label's PlanTextPrimitive, anchored at the room's seedPoint. */
export function buildRoomLabelPrimitive<TId>(
  source: RoomLabelSource<TId>,
  styleToken: PlanTextPrimitive<TId>['styleToken'],
): PlanTextPrimitive<TId> {
  return {
    kind: 'text',
    elementId: source.elementId,
    anchor: source.seedPoint,
    text: roomLabelText(source),
    styleToken,
  };
}

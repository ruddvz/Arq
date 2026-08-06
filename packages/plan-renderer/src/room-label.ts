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
export function roomLabelNameLine<TId>(
  source: Pick<RoomLabelSource<TId>, 'name' | 'number'>,
): string {
  return source.number === undefined ? source.name : `${source.number} ${source.name}`;
}

/** Area formatted to one decimal place, in square metres - matching room-area.ts's (ARQ-114) own unit. */
export function roomLabelAreaLine<TId>(
  source: Pick<RoomLabelSource<TId>, 'areaSquareMetres'>,
): string {
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

/**
 * Whether a room's label fits inside the room, at the scale it is being drawn.
 *
 * Room labels are placed and never checked, which is fine at a scale where the
 * rooms are large and wrong at every other one: on a phone the golden fixture's
 * galleries are a few millimetres wide on screen and their labels are wider
 * than the rooms, so three of them overlap into an unreadable smear that also
 * obscures the walls underneath. Suppressing a label that cannot fit is the
 * honest answer - the room is still drawn, still selectable, and still names
 * itself in the Inspector, and nothing is claimed that cannot be read.
 *
 * Measured in screen pixels rather than world units because that is what
 * legibility depends on: the same room is legible zoomed in and not zoomed out,
 * and the label does not shrink with the drawing.
 */
export function roomLabelFits(measurements: {
  readonly labelWidthPx: number;
  readonly labelHeightPx: number;
  readonly roomWidthPx: number;
  readonly roomHeightPx: number;
}): boolean {
  const { labelWidthPx, labelHeightPx, roomWidthPx, roomHeightPx } = measurements;
  if (!Number.isFinite(labelWidthPx) || !Number.isFinite(labelHeightPx)) return false;
  if (labelWidthPx <= 0 || labelHeightPx <= 0) return false;
  // A label pressed against the walls it sits between reads as touching them.
  // The margin is a fraction rather than a fixed number of pixels so it holds
  // at any zoom.
  return (
    roomWidthPx >= labelWidthPx * (1 + ROOM_LABEL_MARGIN) &&
    roomHeightPx >= labelHeightPx * (1 + ROOM_LABEL_MARGIN)
  );
}

/** Clear space required around a label, as a fraction of its own size. */
const ROOM_LABEL_MARGIN = 0.25;

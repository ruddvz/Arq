/**
 * ARQ-114: implement room area.
 *
 * The "calculate area" step of blueprint section 49's First workflow,
 * once a boundary already exists (room-boundary-graph.ts, ARQ-111;
 * room-placement-tool.ts, ARQ-112): reuses geometry-2d's polygonArea
 * (ARQ-085) on the Room's own calculatedBoundary rather than
 * reimplementing the shoelace formula here.
 *
 * polygonArea returns a raw world-space area (world units squared).
 * Room.calculatedArea is a plain number (room.ts, ARQ-110, matching
 * contracts/model.ts) with no unit tag of its own, so turning a raw
 * world-space area into the number a user actually reads needs *a*
 * unit assumption - this module treats world-space units as
 * millimetres for that conversion (mm^2 -> m^2, dividing by
 * 1,000,000), the same provisional stance opening.ts already takes
 * bridging a typed Length against a geometry-2d plain-number distance;
 * ADR-0004/D-014 (canonical unit representation) is still undecided,
 * and nothing here resolves it.
 *
 * roomAreaIsTooSmall is a plain predicate, not a stored default
 * threshold: blueprint section 40 names exactly seven tolerances
 * (tolerance.ts, ARQ-081) and a minimum-room-area value is not one of
 * them, so this module does not invent an eighth - the caller
 * classifying a Room's status as 'too-small' (section 49) supplies its
 * own threshold explicitly, the same "tolerance is explicit, never a
 * hidden default" policy ARQ-081 already establishes.
 *
 * Deriving a Room's full `status` (combining boundary-tracing status -
 * 'not-enclosed'/'invalid-polygon'/'overlapping' - with an area-based
 * 'too-small' classification) is a separate, larger orchestration
 * concern this module does not take on: recalculateRoomArea only
 * updates calculatedArea, leaving `status` for the caller that already
 * knows the tracing outcome to set.
 */

import { polygonArea } from '@arq/geometry-2d';
import type { WorldPoint } from '@arq/geometry-2d';
import type { Room } from './room';

const SQUARE_MILLIMETRES_PER_SQUARE_METRE = 1_000_000;

/** The area a boundary encloses, in square metres - see this module's doc comment for the mm-per-world-unit provisional stance. */
export function roomAreaSquareMetres(boundary: readonly WorldPoint[]): number {
  return polygonArea(boundary) / SQUARE_MILLIMETRES_PER_SQUARE_METRE;
}

/** Recomputes a Room's calculatedArea from its current calculatedBoundary - everything else on the Room is unchanged. */
export function recalculateRoomArea(room: Room): Room {
  return { ...room, calculatedArea: roomAreaSquareMetres(room.calculatedBoundary) };
}

/** Section 49's "too-small" status rule as a plain predicate - `minimumSquareMetres` is always caller-supplied, never a stored default (see this module's doc comment). */
export function roomAreaIsTooSmall(areaSquareMetres: number, minimumSquareMetres: number): boolean {
  return areaSquareMetres < minimumSquareMetres;
}

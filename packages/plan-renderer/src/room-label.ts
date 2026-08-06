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

import {
  DEFAULT_TOLERANCES,
  pointInPolygon,
  segmentIntersection,
  worldPoint,
  type WorldPoint,
} from '@arq/geometry-2d';
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

export interface RoomLabelFitQuery {
  /** The room's boundary ring, in world units. Single ring, as everywhere else here. */
  readonly polygon: readonly WorldPoint[];
  /** Where the label will be drawn - its centre, matching the renderer's centred text. */
  readonly anchor: WorldPoint;
  /** The label's drawn width in *world* units: its measured pixel width over pixels-per-unit. */
  readonly labelWidth: number;
  /** The label's drawn height in world units, all lines included. */
  readonly labelHeight: number;
  /**
   * How far inside the ring the room's usable floor actually starts, in world
   * units - half the thickness of the walls that bound it.
   *
   * A room's calculated boundary runs to the wall centrelines, so half a wall
   * is inside the ring and underneath poché. Without this a label is measured
   * against floor it does not have.
   */
  readonly wallInset: number;
  /**
   * Linework that will be drawn over this room, and how far the label has to
   * stay from each piece of it.
   *
   * A room's ring is what the project *says* bounds it. It is not what gets
   * drawn: a wall can cross a room whose boundary was calculated before that
   * wall was added, and a door's swing arc sweeps into the room by design and
   * belongs to no room at all. Both were happening on the golden fixture -
   * "Linen" had an interior wall through the middle of the word, and "Inner
   * hall" and "Entry foyer" each had a swing arc struck through their area.
   * Containment in the ring cannot see either, because neither is part of it.
   *
   * `clearance` is the half-thickness of a wall, or zero for a line with no
   * width of its own. Anything a reader would have to read *through* belongs
   * here; anything hidden inside a wall's own footprint does not.
   */
  readonly obstacles?: readonly RoomLabelObstacle[];
}

export interface RoomLabelObstacle {
  readonly start: WorldPoint;
  readonly end: WorldPoint;
  /** Half the drawn width of the thing, in world units. Zero for a hairline. */
  readonly clearance: number;
}

/**
 * Whether a segment crosses any of a box's four edges.
 *
 * `segmentIntersection` returns null for a near-parallel pair, which is right
 * for its own purpose and would be a hole here if a box had one edge. It does
 * not: a line parallel to one pair of edges is transverse to the other pair, so
 * a crossing is always seen by at least one of the four questions.
 */
function segmentMeetsBox(
  segment: { readonly start: WorldPoint; readonly end: WorldPoint },
  corners: readonly WorldPoint[],
): boolean {
  for (let side = 0; side < 4; side += 1) {
    const hit = segmentIntersection(
      segment,
      { start: corners[side]!, end: corners[(side + 1) % 4]! },
      DEFAULT_TOLERANCES.angularEpsilon,
    );
    if (hit !== null) return true;
  }
  return false;
}

/**
 * Whether a room's label fits inside the room, at the scale it is being drawn.
 *
 * Room labels used to be placed and never checked, which is fine at a scale
 * where the rooms are large and wrong at every other one: on a phone the golden
 * fixture's galleries are a few millimetres wide on screen and their labels are
 * wider than the rooms, so three of them overlap into an unreadable smear that
 * also obscures the walls underneath. Suppressing a label that cannot fit is
 * the honest answer - the room is still drawn, still selectable, and still
 * names itself in the Inspector, and nothing is claimed that cannot be read.
 *
 * The check is exact containment of the label's box in the room's ring, not a
 * comparison of bounding boxes. The bounding-box version was wrong for every
 * room that is not a centred rectangle, and it was wrong in the direction that
 * shows: a label is drawn centred on the room's *centroid*, an L-shaped or
 * offset room's centroid is not its bounding box's centre, and so a label that
 * cleared the bounding box arithmetically still ran out over the poché. "Linen"
 * and "Inner hall" were both doing exactly that on the phone capture - the
 * numbers said they fitted and the drawing showed a wall through the middle of
 * the word.
 *
 * Containment in the ring is necessary and not sufficient, so the caller also
 * hands over the linework it is about to draw - see `obstacles`. A room label
 * competes with everything painted on top of it, not only with its own walls.
 *
 * Sizes arrive in world units rather than pixels because containment is a
 * geometric question about the room, and the caller already knows the scale.
 * Legibility is still a screen-pixel question, and still the caller's: it
 * measures the text on the canvas at the size it will paint it, and divides.
 */
export function roomLabelFits(query: RoomLabelFitQuery): boolean {
  const { polygon, anchor, labelWidth, labelHeight, wallInset, obstacles = [] } = query;
  if (polygon.length < 3) return false;
  if (!Number.isFinite(labelWidth) || !Number.isFinite(labelHeight)) return false;
  if (!Number.isFinite(wallInset) || wallInset < 0) return false;
  if (labelWidth <= 0 || labelHeight <= 0) return false;

  /*
   * Growing the label's box by the wall inset is how the ring is shrunk back to
   * the floor: a box that clears a grown boundary clears the real one. At a
   * concave corner it asks for slightly more room than strictly necessary,
   * which is the safe direction to be wrong in.
   */
  const halfWidth = (labelWidth * (1 + ROOM_LABEL_MARGIN)) / 2 + wallInset;
  const halfHeight = (labelHeight * (1 + ROOM_LABEL_MARGIN)) / 2 + wallInset;
  const minX = anchor.x - halfWidth;
  const maxX = anchor.x + halfWidth;
  const minY = anchor.y - halfHeight;
  const maxY = anchor.y + halfHeight;

  // The anchor itself has to be in the room before anything else is worth
  // asking - an area centroid can fall outside a concave room entirely.
  if (!pointInPolygon(polygon, anchor, DEFAULT_TOLERANCES.coordinateEpsilon)) {
    return false;
  }

  const corners = [
    worldPoint(minX, minY),
    worldPoint(maxX, minY),
    worldPoint(maxX, maxY),
    worldPoint(minX, maxY),
  ];

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;

    /*
     * A boundary vertex inside the box means the wall turns a corner inside the
     * word. That case can escape the crossing test below when both of its edges
     * meet the box at a shallow angle, so it is asked directly.
     */
    if (start.x > minX && start.x < maxX && start.y > minY && start.y < maxY) {
      return false;
    }

    if (segmentMeetsBox({ start, end }, corners)) {
      return false;
    }
  }

  for (const obstacle of obstacles) {
    if (!Number.isFinite(obstacle.clearance) || obstacle.clearance < 0) return false;
    /*
     * Growing the box by the obstacle's own clearance is the same trick as the
     * wall inset above, and slightly conservative for the same reason: the true
     * keep-out is a rounded rectangle and this is its bounding one, so a line
     * passing diagonally past a corner is refused a little sooner than it
     * strictly must be. Erring towards an unlabelled room rather than a struck
     * -through one is the right direction.
     */
    const grown = [
      worldPoint(minX - obstacle.clearance, minY - obstacle.clearance),
      worldPoint(maxX + obstacle.clearance, minY - obstacle.clearance),
      worldPoint(maxX + obstacle.clearance, maxY + obstacle.clearance),
      worldPoint(minX - obstacle.clearance, maxY + obstacle.clearance),
    ];
    const inside = (point: WorldPoint): boolean =>
      point.x >= grown[0]!.x &&
      point.x <= grown[1]!.x &&
      point.y >= grown[0]!.y &&
      point.y <= grown[2]!.y;
    // A segment that ends inside the box never crosses its edges, so both are
    // asked: endpoints first, because that is the cheap half.
    if (inside(obstacle.start) || inside(obstacle.end)) return false;
    if (segmentMeetsBox({ start: obstacle.start, end: obstacle.end }, grown)) return false;
  }

  return true;
}

/**
 * How many candidate positions across the room's width and height are tried.
 *
 * Seven is a compromise found by looking at the golden fixture rather than
 * derived: five leaves the fixture's galleries and its "Linen" cupboard
 * unlabelled where a person would clearly have found a spot, and nine costs
 * roughly twice as much per repaint to name one more room. The grid is coarse
 * on purpose - a label is not being optimised into a corner, only moved off the
 * thing that was drawn through it.
 */
const ANCHOR_GRID = 7;

/**
 * Where a room's label could go, best position first.
 *
 * A label anchored at the centroid and nowhere else is the reason a plan drops
 * names it could easily have carried: the centroid is one point, and a room
 * with a door swinging through its middle or a wall crossing it has no floor
 * *there* while having plenty a few hundred millimetres away. On the golden
 * fixture at phone scale, refusing every label that clashed with linework left
 * four rooms named out of nine; trying other positions in the same room brings
 * most of them back without drawing a single word over anything.
 *
 * The centroid still leads, and the rest are ordered by how far they are from
 * it, so a label only moves as far as it has to and a room whose middle is
 * clear is labelled in its middle. Positions outside the ring are dropped
 * rather than offered, which is also what makes this safe for a concave room
 * whose centroid is not inside it at all.
 *
 * This returns positions; it does not judge them. `roomLabelFits` does that,
 * because whether a label fits depends on the label.
 */
export function roomLabelAnchors(polygon: readonly WorldPoint[]): readonly WorldPoint[] {
  if (polygon.length < 3) return [];

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const vertex of polygon) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return [];

  const centroid = polygonCentroid(polygon);
  const candidates: WorldPoint[] = [];
  for (let row = 0; row < ANCHOR_GRID; row += 1) {
    for (let column = 0; column < ANCHOR_GRID; column += 1) {
      // Cell centres, so no candidate ever lands on the boundary itself.
      const x = minX + ((column + 0.5) * (maxX - minX)) / ANCHOR_GRID;
      const y = minY + ((row + 0.5) * (maxY - minY)) / ANCHOR_GRID;
      const point = worldPoint(x, y);
      if (pointInPolygon(polygon, point, DEFAULT_TOLERANCES.coordinateEpsilon)) {
        candidates.push(point);
      }
    }
  }
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - centroid.x, a.y - centroid.y) -
      Math.hypot(b.x - centroid.x, b.y - centroid.y),
  );

  return pointInPolygon(polygon, centroid, DEFAULT_TOLERANCES.coordinateEpsilon)
    ? [centroid, ...candidates]
    : candidates;
}

/**
 * Area centroid of a simple polygon. Falls back to the vertex average for a
 * degenerate (zero-area) ring, which cannot be a real room but can be a
 * malformed one.
 */
export function polygonCentroid(polygon: readonly WorldPoint[]): WorldPoint {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const cross = current.x * next.y - next.x * current.y;
    twiceArea += cross;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }
  if (twiceArea === 0) {
    const count = Math.max(1, polygon.length);
    return worldPoint(
      polygon.reduce((sum, point) => sum + point.x, 0) / count,
      polygon.reduce((sum, point) => sum + point.y, 0) / count,
    );
  }
  return worldPoint(x / (3 * twiceArea), y / (3 * twiceArea));
}

/**
 * Clear space required around a label, as a fraction of its own size.
 *
 * A quarter of the label's own size. It was raised to a half at one point,
 * after "Linen" and "Guest ensuite" both cleared their walls by a couple of
 * pixels and both plainly looked wrong - but that was a symptom of two things
 * that have since been fixed rather than of the margin being too small. The
 * text was being measured in the wrong font, about twenty per cent narrow, and
 * the fit test compared bounding boxes and could not see a wall crossing a room
 * or a door swinging through one.
 *
 * With the measurement right, containment exact, every wall held at its own
 * real thickness and the label free to move within its room, a half is no
 * longer buying clearance - it is only refusing rooms. On the golden fixture at
 * phone scale it cost five names that a person would plainly have written in.
 */
const ROOM_LABEL_MARGIN = 0.25;

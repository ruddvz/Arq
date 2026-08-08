/**
 * The content that stands on a level and is not a wall: furnishings, floor
 * slabs, and stair flights and landings.
 *
 * It exists because a project can contain a great deal that the wall/opening/
 * room vocabulary has no word for, and until now all of it was dropped on open
 * without being counted. ARQ House 17.0 carries 140 fixtures and furniture
 * items, three floor slabs and a two-flight dogleg stair; the app read none of
 * them and said nothing, so a coordinated house arrived on screen as an empty
 * shell and there was no way to tell "not modelled" from "thrown away".
 *
 * ## Why a footprint is a polygon and not a box
 *
 * The source records an axis-aligned `bounds` plus a `rotationDegrees` about
 * the item's own centre, and a fifth of this fixture's items are rotated - the
 * angled lounge chairs, the 90-degree beds, the pergola. Two renderers each
 * applying that rotation themselves is exactly how plan and 3D come to disagree
 * about where a thing is (blueprint section 45's named bug). So the rotation is
 * resolved once, here, into four world-space corners, and both surfaces draw the
 * polygon they are given. The angle is kept alongside for anything that needs to
 * orient a label or a texture, but nothing has to use it to find the shape.
 *
 * ## Why stairs are flights and landings rather than a Stair
 *
 * `@arq/bim-core`'s StairInstance is deliberately bounded to a single straight
 * flight, and says so: "A shape it cannot describe is absent rather than
 * approximated, because a stair silently flattened into a straight run is worse
 * than no stair." This fixture's stair is two flights around a mid-landing.
 * Flattening it into one straight run would put treads through a wall, so this
 * carries the parts the file actually states - each flight's rectangle, its rise
 * and its tread count, and each landing's rectangle and level - and does not
 * pretend to be the semantic Stair that cannot hold them yet.
 *
 * Nothing here is invented. Every field is read from the file or rejected; a
 * furnishing with no usable footprint is a rejected model, not a furnishing
 * drawn at the origin.
 */
import { worldPoint, type WorldPoint } from '@arq/geometry-2d';

/** An axis-aligned extent in the source's own vocabulary, before rotation. */
interface Extent {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * One piece of furniture, sanitary fitting, appliance or fixed equipment.
 *
 * `kind` is kept as the file's own word rather than mapped onto a closed set.
 * The fixture uses 64 of them - `bed-queen`, `oven-stack`, `prayer-niche`,
 * `solar-panel` - and a closed set would have to either grow every time a
 * project names something new or silently collapse the ones it does not know
 * into `other`, which loses the only information the field carries. A renderer
 * that wants to treat some kinds specially can match on the ones it knows and
 * fall back for the rest; that is a renderer's decision, not the model's.
 */
export interface NativeFurnishing {
  readonly id: string;
  readonly levelId: string;
  /** The room it is placed in, or null when the file does not assign one. */
  readonly roomId: string | null;
  readonly kind: string;
  /** Four world-space corners, with `rotationDegrees` already applied. */
  readonly footprint: readonly WorldPoint[];
  /** Rotation about the footprint centre, in degrees, as the file states it. */
  readonly rotationDegrees: number;
  /** Height above the floor, in millimetres. */
  readonly heightMillimetres: number;
  /** The stated material name, or null. Free vocabulary, same reasoning as `kind`. */
  readonly material: string | null;
}

/** A floor or roof plate, as an outer ring with the holes cut out of it. */
export interface NativeSlab {
  readonly id: string;
  readonly levelId: string;
  /** The outer boundary, closed implicitly (first point is not repeated). */
  readonly outline: readonly WorldPoint[];
  /** Holes through the plate - a stairwell, a courtyard - each its own ring. */
  readonly voids: readonly (readonly WorldPoint[])[];
  readonly thicknessMillimetres: number;
}

/**
 * One straight run of a stair.
 *
 * `baseElevation`/`topElevation` are absolute heights above the project datum,
 * not offsets from a level, because a flight generally starts on one level and
 * ends on another and the mid-landing of a dogleg belongs to neither. The file
 * states them absolutely and converting them to per-level offsets would need a
 * level to attribute them to, which is the question this shape avoids answering
 * wrongly.
 */
export interface NativeStairFlight {
  readonly id: string;
  readonly stairId: string;
  /** The flight's plan rectangle, as four corners. */
  readonly footprint: readonly WorldPoint[];
  /** Where the walking line enters the flight, at `baseElevation`. */
  readonly start: WorldPoint;
  /** Where it leaves, at `topElevation`. */
  readonly end: WorldPoint;
  readonly baseElevation: number;
  readonly topElevation: number;
  readonly riserCount: number;
  readonly treadCount: number;
}

/** A flat resting place between or at the end of flights. */
export interface NativeStairLanding {
  readonly id: string;
  readonly stairId: string;
  readonly footprint: readonly WorldPoint[];
  readonly elevation: number;
}

export interface NativeStair {
  readonly id: string;
  readonly flights: readonly NativeStairFlight[];
  readonly landings: readonly NativeStairLanding[];
}

export interface PlacedContent {
  readonly furnishings: readonly NativeFurnishing[];
  readonly slabs: readonly NativeSlab[];
  readonly stairs: readonly NativeStair[];
}

export const EMPTY_PLACED_CONTENT: PlacedContent = {
  furnishings: [],
  slabs: [],
  stairs: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * An extent from either shape the sources use: a `{x1,y1,x2,y2}` record or a
 * four-number `[x1,y1,x2,y2]` array. Both appear in the same file - furnishing
 * bounds are records, slab outlines and voids are arrays - and normalising here
 * keeps that difference out of every caller.
 *
 * Rejects a degenerate extent rather than accepting it: a zero-width footprint
 * is a polygon with no area, which draws as nothing and hit-tests as nothing,
 * so it is a defect worth naming rather than an item that silently disappears.
 */
function extent(value: unknown): Extent | null {
  let x1: number | null;
  let y1: number | null;
  let x2: number | null;
  let y2: number | null;
  if (Array.isArray(value) && value.length === 4) {
    const [a, b, c, d] = value;
    x1 = finite(a);
    y1 = finite(b);
    x2 = finite(c);
    y2 = finite(d);
  } else if (isRecord(value)) {
    x1 = finite(value.x1);
    y1 = finite(value.y1);
    x2 = finite(value.x2);
    y2 = finite(value.y2);
  } else {
    return null;
  }
  if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
  // Normalised rather than required in order, so a source that writes a
  // rectangle right-to-left still describes the same rectangle.
  const [minX, maxX] = x1 <= x2 ? [x1, x2] : [x2, x1];
  const [minY, maxY] = y1 <= y2 ? [y1, y2] : [y2, y1];
  if (maxX - minX <= 0 || maxY - minY <= 0) return null;
  return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}

/** The rectangle's four corners, anticlockwise from its minimum, unrotated. */
function corners(bounds: Extent): readonly WorldPoint[] {
  return [
    worldPoint(bounds.x1, bounds.y1),
    worldPoint(bounds.x2, bounds.y1),
    worldPoint(bounds.x2, bounds.y2),
    worldPoint(bounds.x1, bounds.y2),
  ];
}

/**
 * The same corners turned about the rectangle's own centre.
 *
 * Zero is special-cased to return the exact unrotated coordinates: four fifths
 * of this fixture's items are unrotated, and `cos(0)`/`sin(0)` round-tripping
 * would move some of them by a floating-point hair. A wall-anchored cabinet that
 * lands 1e-13 mm off the wall it is anchored to fails a clearance check for a
 * reason that has nothing to do with the building.
 */
function rotatedCorners(bounds: Extent, degrees: number): readonly WorldPoint[] {
  const square = corners(bounds);
  if (degrees === 0) return square;
  const centreX = (bounds.x1 + bounds.x2) / 2;
  const centreY = (bounds.y1 + bounds.y2) / 2;
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return square.map((corner) => {
    const dx = corner.x - centreX;
    const dy = corner.y - centreY;
    return worldPoint(centreX + dx * cos - dy * sin, centreY + dx * sin + dy * cos);
  });
}

export class RejectedPlacedContent extends Error {}

function fail(reason: string): never {
  throw new RejectedPlacedContent(reason);
}

function parseFurnishings(raw: readonly unknown[]): readonly NativeFurnishing[] {
  return raw.map((entry, index) => {
    if (!isRecord(entry)) fail(`model.json furnishings[${index}] is not an object`);
    const id = nonEmpty(entry.id);
    const levelId = nonEmpty(entry.levelId);
    const kind = nonEmpty(entry.kind);
    if (id === null || levelId === null || kind === null) {
      fail(`model.json furnishings[${index}] is missing a usable id, levelId or kind`);
    }
    const bounds = extent(entry.bounds);
    if (bounds === null) {
      fail(`model.json furnishings[${index}] (${id}) has no usable footprint bounds`);
    }
    const height = finite(entry.height);
    if (height === null || height <= 0) {
      fail(`model.json furnishings[${index}] (${id}) has no usable height`);
    }
    const rotationDegrees = finite(entry.rotationDegrees) ?? 0;
    return {
      id,
      levelId,
      roomId: nonEmpty(entry.roomId),
      kind,
      footprint: rotatedCorners(bounds, rotationDegrees),
      rotationDegrees,
      heightMillimetres: height,
      material: nonEmpty(entry.material),
    };
  });
}

function parseSlabs(raw: readonly unknown[]): readonly NativeSlab[] {
  return raw.map((entry, index) => {
    if (!isRecord(entry)) fail(`model.json slabs[${index}] is not an object`);
    const id = nonEmpty(entry.id);
    const levelId = nonEmpty(entry.levelId);
    if (id === null || levelId === null) {
      fail(`model.json slabs[${index}] is missing a usable id or levelId`);
    }
    const outer = extent(entry.outer);
    if (outer === null) fail(`model.json slabs[${index}] (${id}) has no usable outline`);
    const thickness = finite(entry.thickness);
    if (thickness === null || thickness <= 0) {
      fail(`model.json slabs[${index}] (${id}) has no usable thickness`);
    }
    const rawVoids = Array.isArray(entry.voids) ? entry.voids : [];
    const voids = rawVoids.map((hole, holeIndex) => {
      const bounds = extent(hole);
      if (bounds === null) {
        fail(`model.json slabs[${index}] (${id}) void ${holeIndex} is not a usable rectangle`);
      }
      return corners(bounds);
    });
    return {
      id,
      levelId,
      outline: corners(outer),
      voids,
      thicknessMillimetres: thickness,
    };
  });
}

/**
 * The walking line's entry and exit points for a flight.
 *
 * The source gives a flight as an x span plus a `yStart`/`yEnd` pair, so the
 * line runs up the middle of the x span from one y to the other. Taking the
 * midpoint rather than an edge is what makes the direction of travel readable:
 * an arrow drawn along it points the way the stair goes up, which is the one
 * thing a stair symbol in plan has to say.
 */
function walkingLine(
  bounds: Extent,
  yStart: number,
  yEnd: number,
): { readonly start: WorldPoint; readonly end: WorldPoint } {
  const midX = (bounds.x1 + bounds.x2) / 2;
  return { start: worldPoint(midX, yStart), end: worldPoint(midX, yEnd) };
}

function parseStairs(raw: readonly unknown[]): readonly NativeStair[] {
  return raw.map((entry, index) => {
    if (!isRecord(entry)) fail(`model.json stairs[${index}] is not an object`);
    const stairId = nonEmpty(entry.id);
    if (stairId === null) fail(`model.json stairs[${index}] is missing a usable id`);

    const rawFlights = Array.isArray(entry.flightDefinitions) ? entry.flightDefinitions : [];
    const flights = rawFlights.map((flight, flightIndex) => {
      if (!isRecord(flight)) {
        fail(`model.json stairs[${index}] (${stairId}) flight ${flightIndex} is not an object`);
      }
      const id = nonEmpty(flight.id);
      const yStart = finite(flight.yStart);
      const yEnd = finite(flight.yEnd);
      const baseElevation = finite(flight.startZ);
      const topElevation = finite(flight.endZ);
      const riserCount = finite(flight.riserCount);
      const treadCount = finite(flight.treadCount);
      if (
        id === null ||
        yStart === null ||
        yEnd === null ||
        baseElevation === null ||
        topElevation === null ||
        riserCount === null ||
        treadCount === null
      ) {
        fail(
          `model.json stairs[${index}] (${stairId}) flight ${flightIndex} is missing a usable id, extent, rise or step count`,
        );
      }
      const bounds = extent({ x1: flight.x1, y1: yStart, x2: flight.x2, y2: yEnd });
      if (bounds === null) {
        fail(
          `model.json stairs[${index}] (${stairId}) flight ${flightIndex} has no usable footprint`,
        );
      }
      return {
        id,
        stairId,
        footprint: corners(bounds),
        ...walkingLine(bounds, yStart, yEnd),
        baseElevation,
        topElevation,
        riserCount,
        treadCount,
      } satisfies NativeStairFlight;
    });

    const rawLandings = Array.isArray(entry.landingDefinitions) ? entry.landingDefinitions : [];
    const landings = rawLandings.map((landing, landingIndex) => {
      if (!isRecord(landing)) {
        fail(`model.json stairs[${index}] (${stairId}) landing ${landingIndex} is not an object`);
      }
      const id = nonEmpty(landing.id);
      const elevation = finite(landing.z);
      const bounds = extent(landing);
      if (id === null || elevation === null || bounds === null) {
        fail(
          `model.json stairs[${index}] (${stairId}) landing ${landingIndex} is missing a usable id, extent or elevation`,
        );
      }
      return { id, stairId, footprint: corners(bounds), elevation } satisfies NativeStairLanding;
    });

    if (flights.length === 0 && landings.length === 0) {
      fail(`model.json stairs[${index}] (${stairId}) has neither a flight nor a landing`);
    }
    return { id: stairId, flights, landings };
  });
}

/**
 * Reads the three optional sections, or explains why they cannot be read.
 *
 * Absent sections are not an error: a project written by this build has none of
 * them, and requiring them would refuse files the product itself produced. A
 * section that is present and malformed is an error, because that is a file
 * claiming to contain furniture and failing to say where any of it is.
 */
export function parsePlacedContent(
  raw: Record<string, unknown>,
):
  | { readonly status: 'parsed'; readonly content: PlacedContent }
  | { readonly status: 'rejected'; readonly reason: string } {
  try {
    return {
      status: 'parsed',
      content: {
        furnishings: Array.isArray(raw.furnishings) ? parseFurnishings(raw.furnishings) : [],
        slabs: Array.isArray(raw.slabs) ? parseSlabs(raw.slabs) : [],
        stairs: Array.isArray(raw.stairs) ? parseStairs(raw.stairs) : [],
      },
    };
  } catch (error) {
    if (error instanceof RejectedPlacedContent) {
      return { status: 'rejected', reason: error.message };
    }
    throw error;
  }
}

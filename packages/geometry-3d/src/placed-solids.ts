/**
 * Solids for the content that stands on a level and is not a wall: floor and
 * roof plates with holes in them, and stair flights.
 *
 * Both are shapes `extrudePolygonMesh` cannot make on its own, for opposite
 * reasons. A plate with a courtyard cut out of it is one outline with holes,
 * and that module caps a solid with a triangle fan, which fills any hole it is
 * given. A stair is not one solid at all - it is a stack of treads, and
 * extruding its footprint produces the ramp the plan renderer refuses to draw.
 *
 * Neither builds meshes. Both return outlines and elevations for
 * `extrudePolygonMesh` to extrude, so there is exactly one place in the
 * repository that turns a 2D outline into a solid and exactly one set of
 * winding and normal rules to get wrong.
 */
import { worldPoint, type WorldPoint } from '@arq/geometry-2d';

/** An axis-aligned rectangle, as the two extreme corners. */
export interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** One piece to extrude: a closed outline, a base height and a thickness. */
export interface PlacedSolid {
  readonly id: string;
  readonly outline: readonly WorldPoint[];
  readonly baseElevation: number;
  readonly height: number;
}

/** The rectangle a ring of points spans, or null if it spans nothing. */
export function rectOfRing(ring: readonly WorldPoint[]): Rect | null {
  if (ring.length < 3) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of ring) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return maxX > minX && maxY > minY ? { minX, minY, maxX, maxY } : null;
}

function ringOfRect(rect: Rect): readonly WorldPoint[] {
  return [
    worldPoint(rect.minX, rect.minY),
    worldPoint(rect.maxX, rect.minY),
    worldPoint(rect.maxX, rect.maxY),
    worldPoint(rect.minX, rect.maxY),
  ];
}

/**
 * A plate with rectangular holes, cut into solid rectangles.
 *
 * The outer rectangle is sliced along every hole edge, in both axes, into a
 * grid; each cell is either wholly inside a hole or wholly outside all of them,
 * because the cuts are exactly the hole boundaries. Keeping the outside cells
 * gives a set of rectangles whose union is the plate and whose intersection
 * with any hole is empty.
 *
 * Rectangles rather than a triangulated polygon-with-holes: the holes in a
 * floor plate are stairwells and courtyards, which are rectangular in every
 * project this has to read, and a general polygon triangulator is a large
 * dependency to take on for a case that does not arise. A non-rectangular hole
 * degrades honestly - `rectOfRing` reduces it to its bounding box, which
 * removes at least as much floor as the hole does, so nothing is ever left
 * standing over a void.
 *
 * The cells share faces where they meet. Those internal faces are drawn, and
 * they are coincident in pairs facing opposite ways, so front-face culling
 * hides both from any camera outside the plate - which is every camera, since
 * the plate is solid.
 */
export function plateCells(
  outline: readonly WorldPoint[],
  voids: readonly (readonly WorldPoint[])[],
): readonly Rect[] {
  const outer = rectOfRing(outline);
  if (outer === null) return [];

  const holes = voids
    .map(rectOfRing)
    .filter((hole): hole is Rect => hole !== null)
    // A hole entirely outside the plate cuts nothing and would only add
    // gridlines, so it is dropped rather than clipped.
    .filter(
      (hole) =>
        hole.maxX > outer.minX &&
        hole.minX < outer.maxX &&
        hole.maxY > outer.minY &&
        hole.minY < outer.maxY,
    );
  if (holes.length === 0) return [outer];

  const cuts = (axis: 'x' | 'y'): readonly number[] => {
    const lower = axis === 'x' ? outer.minX : outer.minY;
    const upper = axis === 'x' ? outer.maxX : outer.maxY;
    const values = new Set<number>([lower, upper]);
    for (const hole of holes) {
      for (const value of axis === 'x' ? [hole.minX, hole.maxX] : [hole.minY, hole.maxY]) {
        // A cut outside the plate would create an empty column or row.
        if (value > lower && value < upper) values.add(value);
      }
    }
    return [...values].sort((a, b) => a - b);
  };

  const xs = cuts('x');
  const ys = cuts('y');
  const cells: Rect[] = [];
  for (let column = 0; column + 1 < xs.length; column += 1) {
    for (let row = 0; row + 1 < ys.length; row += 1) {
      const cell: Rect = {
        minX: xs[column]!,
        maxX: xs[column + 1]!,
        minY: ys[row]!,
        maxY: ys[row + 1]!,
      };
      // Tested at the centre, which is unambiguous: a cell cannot straddle a
      // hole boundary, because every hole boundary is one of the cuts.
      const midX = (cell.minX + cell.maxX) / 2;
      const midY = (cell.minY + cell.maxY) / 2;
      const inHole = holes.some(
        (hole) => midX > hole.minX && midX < hole.maxX && midY > hole.minY && midY < hole.maxY,
      );
      if (!inHole) cells.push(cell);
    }
  }
  return cells;
}

/** A plate's solid pieces, hung below the level datum by its own thickness. */
export function plateSolids(
  id: string,
  outline: readonly WorldPoint[],
  voids: readonly (readonly WorldPoint[])[],
  /** The level datum - finished floor level, which is the plate's top face. */
  datumElevation: number,
  thickness: number,
): readonly PlacedSolid[] {
  if (!Number.isFinite(datumElevation) || !Number.isFinite(thickness) || thickness <= 0) return [];
  return plateCells(outline, voids).map((cell, index) => ({
    id: `${id}-part-${index}`,
    outline: ringOfRect(cell),
    // The datum is finished floor level, so the plate hangs beneath it. Sitting
    // it on top instead would raise every floor by its own thickness and leave
    // each storey standing 180mm above the walls that carry it.
    baseElevation: datumElevation - thickness,
    height: thickness,
  }));
}

export interface StairFlightGeometry {
  readonly id: string;
  /** The flight's plan rectangle. */
  readonly footprint: readonly WorldPoint[];
  /** The walking line, bottom to top - it fixes which way the treads climb. */
  readonly start: WorldPoint;
  readonly end: WorldPoint;
  readonly baseElevation: number;
  readonly topElevation: number;
  readonly treadCount: number;
}

/**
 * A flight, as one solid per tread.
 *
 * Each tread is the full width of the flight, one tread deep, and stands on the
 * ground with its top at its own going height - a stepped stack rather than a
 * set of floating slabs. Floating treads look right from the side and wrong
 * from underneath, and the underside of a stair over a landing is a place a
 * person walks.
 *
 * The rise per tread is derived from the flight's own stated top and base, not
 * from a riser height: the flight has to land exactly on the level above, and a
 * stored riser height generally misses it by a fraction of a millimetre. This
 * is the same reasoning `@arq/bim-core`'s StairInstance gives for storing the
 * riser *count*.
 */
export function stairFlightSolids(flight: StairFlightGeometry): readonly PlacedSolid[] {
  const treads = Math.floor(flight.treadCount);
  const rise = flight.topElevation - flight.baseElevation;
  if (treads < 1 || !Number.isFinite(rise) || rise <= 0) return [];
  const bounds = rectOfRing(flight.footprint);
  if (bounds === null) return [];

  const runX = flight.end.x - flight.start.x;
  const runY = flight.end.y - flight.start.y;
  const alongX = Math.abs(runX) >= Math.abs(runY);
  const span = alongX ? bounds.maxX - bounds.minX : bounds.maxY - bounds.minY;
  const depth = span / treads;
  // Climbing in -x or -y means the first tread is at the far end of the span.
  const ascending = alongX ? runX >= 0 : runY >= 0;

  const solids: PlacedSolid[] = [];
  for (let index = 0; index < treads; index += 1) {
    const step = ascending ? index : treads - 1 - index;
    const near = (alongX ? bounds.minX : bounds.minY) + step * depth;
    const cell: Rect = alongX
      ? { minX: near, maxX: near + depth, minY: bounds.minY, maxY: bounds.maxY }
      : { minX: bounds.minX, maxX: bounds.maxX, minY: near, maxY: near + depth };
    const top = flight.baseElevation + ((index + 1) * rise) / treads;
    solids.push({
      id: `${flight.id}-tread-${index}`,
      outline: ringOfRect(cell),
      baseElevation: flight.baseElevation,
      height: top - flight.baseElevation,
    });
  }
  return solids;
}

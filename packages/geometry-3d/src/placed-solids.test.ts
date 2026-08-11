import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { plateCells, plateSolids, rectOfRing, stairFlightSolids } from './placed-solids';

function ring(minX: number, minY: number, maxX: number, maxY: number) {
  return [
    worldPoint(minX, minY),
    worldPoint(maxX, minY),
    worldPoint(maxX, maxY),
    worldPoint(minX, maxY),
  ];
}

/** The fixture's own upper plate: 18 x 16 m with a courtyard and a stairwell in it. */
const PLATE = ring(0, 0, 18_000, 16_000);
const COURTYARD = ring(6000, 5000, 12_000, 11_000);
const STAIRWELL = ring(14_000, 300, 17_700, 5000);

function area(
  cells: readonly { minX: number; minY: number; maxX: number; maxY: number }[],
): number {
  return cells.reduce((sum, cell) => sum + (cell.maxX - cell.minX) * (cell.maxY - cell.minY), 0);
}

describe('plateCells', () => {
  it('leaves a plate with no holes whole rather than cutting it up', () => {
    expect(plateCells(PLATE, [])).toEqual([{ minX: 0, minY: 0, maxX: 18_000, maxY: 16_000 }]);
  });

  /**
   * The check that matters. A cell left standing over a courtyard is a floor
   * where the drawing says there is a six-metre drop, and it would look
   * entirely convincing.
   */
  it('leaves nothing standing over a hole', () => {
    for (const cell of plateCells(PLATE, [COURTYARD, STAIRWELL])) {
      const midX = (cell.minX + cell.maxX) / 2;
      const midY = (cell.minY + cell.maxY) / 2;
      for (const hole of [
        { minX: 6000, minY: 5000, maxX: 12_000, maxY: 11_000 },
        { minX: 14_000, minY: 300, maxX: 17_700, maxY: 5000 },
      ]) {
        const inside = midX > hole.minX && midX < hole.maxX && midY > hole.minY && midY < hole.maxY;
        expect(inside).toBe(false);
      }
    }
  });

  /** The other half: the cells have to add up to the plate less its holes, with nothing missing. */
  it('keeps exactly the plate’s area less its holes', () => {
    const plate = 18_000 * 16_000;
    const courtyard = 6000 * 6000;
    const stairwell = 3700 * 4700;
    expect(area(plateCells(PLATE, [COURTYARD, STAIRWELL]))).toBe(plate - courtyard - stairwell);
  });

  it('does not overlap its own cells', () => {
    const cells = plateCells(PLATE, [COURTYARD, STAIRWELL]);
    for (let a = 0; a < cells.length; a += 1) {
      for (let b = a + 1; b < cells.length; b += 1) {
        const first = cells[a]!;
        const second = cells[b]!;
        const overlaps =
          first.minX < second.maxX &&
          second.minX < first.maxX &&
          first.minY < second.maxY &&
          second.minY < first.maxY;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('ignores a hole that misses the plate rather than slicing it for nothing', () => {
    const away = ring(30_000, 30_000, 31_000, 31_000);
    expect(plateCells(PLATE, [away])).toHaveLength(1);
  });

  it('returns nothing for an outline that is not a shape', () => {
    expect(plateCells([worldPoint(0, 0), worldPoint(1, 1)], [])).toEqual([]);
  });
});

describe('plateSolids', () => {
  /**
   * The level datum is finished floor level, so the plate hangs beneath it.
   * Sitting it on top instead raises every floor by its own thickness and
   * leaves each storey standing 180mm above the walls that carry it.
   */
  it('hangs the plate below the datum, not on top of it', () => {
    const [piece] = plateSolids('slab-upper', PLATE, [], 3200, 180);
    expect(piece?.baseElevation).toBe(3020);
    expect(piece?.height).toBe(180);
  });

  it('gives every piece its own id so nothing collides in the scene', () => {
    const ids = plateSolids('slab-upper', PLATE, [COURTYARD, STAIRWELL], 3200, 180).map(
      (piece) => piece.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds nothing for a thickness that is not a thickness', () => {
    expect(plateSolids('slab', PLATE, [], 0, 0)).toEqual([]);
    expect(plateSolids('slab', PLATE, [], 0, Number.NaN)).toEqual([]);
  });
});

/** The fixture's lower flight: 1100 wide, rising 1684.21mm over nine treads, running +y. */
const FLIGHT = {
  id: 'flight-lower',
  footprint: ring(16_400, 500, 17_500, 3020),
  start: worldPoint(16_950, 500),
  end: worldPoint(16_950, 3020),
  baseElevation: 0,
  topElevation: 1684.2105263157894,
  treadCount: 9,
};

describe('stairFlightSolids', () => {
  const treads = stairFlightSolids(FLIGHT);

  it('builds one solid per tread', () => {
    expect(treads).toHaveLength(9);
  });

  /**
   * Each tread stands on the ground rather than floating at its own height.
   * Floating treads look right from the side and wrong from underneath, and the
   * underside of a stair over a landing is a place a person walks.
   */
  it('stands every tread on the base, so the flight is solid underneath', () => {
    for (const tread of treads) expect(tread.baseElevation).toBe(0);
  });

  it('climbs evenly and lands exactly on the top of the flight', () => {
    const tops = treads.map((tread) => tread.baseElevation + tread.height);
    expect(tops[8]).toBeCloseTo(1684.2105263157894, 9);
    for (let index = 1; index < tops.length; index += 1) {
      expect(tops[index]! - tops[index - 1]!).toBeCloseTo(1684.2105263157894 / 9, 9);
    }
  });

  it('steps along the run in the direction of travel', () => {
    const firstY = rectOfRing(treads[0]!.outline)!.minY;
    const lastY = rectOfRing(treads[8]!.outline)!.minY;
    expect(firstY).toBeCloseTo(500, 9);
    expect(lastY).toBeGreaterThan(firstY);
  });

  /**
   * A flight running the other way climbs from the far end of its own
   * footprint. Read from the footprint alone, the stair would rise backwards
   * and arrive at the wrong storey - the second flight of this fixture's dogleg
   * runs -y, so this is the real case and not a hypothetical one.
   */
  it('starts a descending-axis flight at the far end of the run', () => {
    const descending = stairFlightSolids({
      ...FLIGHT,
      id: 'flight-upper',
      start: worldPoint(16_950, 3020),
      end: worldPoint(16_950, 500),
    });
    const firstY = rectOfRing(descending[0]!.outline)!.minY;
    const lastY = rectOfRing(descending[8]!.outline)!.minY;
    expect(lastY).toBeLessThan(firstY);
    // The lowest tread is still the one at the start of travel.
    expect(descending[0]!.height).toBeLessThan(descending[8]!.height);
  });

  it('divides an east-west flight along x rather than along y', () => {
    const eastWest = stairFlightSolids({
      ...FLIGHT,
      id: 'flight-ew',
      footprint: ring(0, 0, 2520, 1100),
      start: worldPoint(0, 550),
      end: worldPoint(2520, 550),
    });
    const first = rectOfRing(eastWest[0]!.outline)!;
    expect(first.maxX - first.minX).toBeCloseTo(280, 9);
    expect(first.maxY - first.minY).toBeCloseTo(1100, 9);
  });

  it('builds nothing for a flight that does not rise', () => {
    expect(stairFlightSolids({ ...FLIGHT, topElevation: 0 })).toEqual([]);
    expect(stairFlightSolids({ ...FLIGHT, treadCount: 0 })).toEqual([]);
  });
});

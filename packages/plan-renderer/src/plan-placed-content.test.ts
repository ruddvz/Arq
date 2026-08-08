import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { furnishingPrimitives, slabPrimitives, stairPrimitives } from './plan-placed-content';

const RECTANGLE = [
  worldPoint(16_400, 500),
  worldPoint(17_500, 500),
  worldPoint(17_500, 3020),
  worldPoint(16_400, 3020),
];

describe('furnishingPrimitives', () => {
  it('draws one outline, not a fill', () => {
    const [primitive, ...rest] = furnishingPrimitives({ id: 'it-desk', footprint: RECTANGLE });
    expect(rest).toEqual([]);
    expect(primitive?.kind).toBe('polygon');
    // No `fill`: 140 filled blocks would hide the plan they are annotating.
    expect(primitive && 'fill' in primitive ? primitive.fill : undefined).toBeUndefined();
  });

  it('draws nothing for a footprint that is not a shape', () => {
    expect(furnishingPrimitives({ id: 'it-bad', footprint: [worldPoint(0, 0)] })).toEqual([]);
  });
});

describe('slabPrimitives', () => {
  it('draws the plate edge and every hole through it', () => {
    const primitives = slabPrimitives({
      id: 'slab-upper',
      outline: RECTANGLE,
      voids: [RECTANGLE, RECTANGLE],
    });
    expect(primitives.map((entry) => entry.elementId)).toEqual([
      'slab-upper',
      'slab-upper-void-0',
      'slab-upper-void-1',
    ]);
  });

  it('draws a plate with no holes as its edge alone', () => {
    expect(slabPrimitives({ id: 'slab-ground', outline: RECTANGLE, voids: [] })).toHaveLength(1);
  });
});

/** A flight rising north: 1100 wide, 2520 long, nine treads. */
const FLIGHT = {
  id: 'flight-lower',
  footprint: RECTANGLE,
  start: worldPoint(16_950, 500),
  end: worldPoint(16_950, 3020),
  treadCount: 9,
};

describe('stairPrimitives', () => {
  const primitives = stairPrimitives({
    id: 'stair-main',
    flights: [FLIGHT],
    landings: [{ id: 'landing-mid', footprint: RECTANGLE }],
  });
  const nosings = primitives.filter((entry) => entry.elementId.includes('-nosing-'));

  it('draws the landing, the flight outline, the nosings and the arrow', () => {
    expect(primitives.some((entry) => entry.elementId === 'landing-mid')).toBe(true);
    expect(primitives.some((entry) => entry.elementId === 'flight-lower')).toBe(true);
    expect(primitives.some((entry) => entry.elementId === 'flight-lower-travel')).toBe(true);
    expect(primitives.some((entry) => entry.elementId === 'flight-lower-travel-head')).toBe(true);
  });

  /**
   * Nine treads have ten edges. Drawing only the eight interior ones leaves the
   * flight open at top and bottom, which reads as a ramp.
   */
  it('draws one more nosing than there are treads', () => {
    expect(nosings).toHaveLength(10);
  });

  it('spaces the nosings evenly along the run, first and last on its ends', () => {
    const ys = nosings.map((entry) =>
      entry.kind === 'line' ? (entry.points[0]?.y ?? Number.NaN) : Number.NaN,
    );
    expect(ys[0]).toBeCloseTo(500, 9);
    expect(ys[9]).toBeCloseTo(3020, 9);
    for (let index = 1; index < ys.length; index += 1) {
      expect(ys[index]! - ys[index - 1]!).toBeCloseTo(280, 9);
    }
  });

  it('spans each nosing across the full width of the flight', () => {
    const first = nosings[0];
    if (first?.kind !== 'line') throw new Error('expected a line');
    const [a, b] = first.points;
    expect(Math.abs((b?.x ?? 0) - (a?.x ?? 0))).toBeCloseTo(1100, 9);
  });

  /**
   * The arrow points the way the stair rises. A reader who cannot tell which
   * way a stair goes up cannot tell a plan of a house from its mirror image,
   * and this is the only primitive that says so.
   */
  it('points the arrow from the bottom of the flight to the top', () => {
    const travel = primitives.find((entry) => entry.elementId === 'flight-lower-travel');
    if (travel?.kind !== 'line') throw new Error('expected a line');
    expect(travel.points[0]?.y).toBe(500);
    expect(travel.points[1]?.y).toBe(3020);
  });

  it('puts the arrowhead barbs behind the tip, not past it', () => {
    const head = primitives.find((entry) => entry.elementId === 'flight-lower-travel-head');
    if (head?.kind !== 'line') throw new Error('expected a line');
    const [left, tip, right] = head.points;
    expect(tip).toEqual({ x: 16_950, y: 3020 });
    expect(left?.y).toBeLessThan(3020);
    expect(right?.y).toBeLessThan(3020);
    // Symmetric about the walking line, or the head reads as a bend.
    expect((left?.x ?? 0) + (right?.x ?? 0)).toBeCloseTo(2 * 16_950, 6);
  });

  /** A head longer than its run is a blot, not a direction. The nosings still say it is a stair. */
  it('leaves a run too short to carry an arrow unmarked', () => {
    const stub = stairPrimitives({
      id: 'stair-stub',
      flights: [
        {
          ...FLIGHT,
          id: 'flight-stub',
          start: worldPoint(16_950, 500),
          end: worldPoint(16_950, 900),
          treadCount: 1,
        },
      ],
      landings: [],
    });
    expect(stub.some((entry) => entry.elementId.includes('-travel'))).toBe(false);
    expect(stub.some((entry) => entry.elementId.includes('-nosing-'))).toBe(true);
  });

  it('draws no nosings for a flight with no treads rather than dividing by zero', () => {
    const degenerate = stairPrimitives({
      id: 'stair-flat',
      flights: [{ ...FLIGHT, id: 'flight-flat', treadCount: 0 }],
      landings: [],
    });
    expect(degenerate.every((entry) => !entry.elementId.includes('-nosing-'))).toBe(true);
  });

  it('draws nosings across an east-west flight, not only a north-south one', () => {
    const eastWest = stairPrimitives({
      id: 'stair-ew',
      flights: [
        {
          id: 'flight-ew',
          footprint: [
            worldPoint(0, 0),
            worldPoint(2520, 0),
            worldPoint(2520, 1100),
            worldPoint(0, 1100),
          ],
          start: worldPoint(0, 550),
          end: worldPoint(2520, 550),
          treadCount: 9,
        },
      ],
      landings: [],
    });
    const first = eastWest.find((entry) => entry.elementId === 'flight-ew-nosing-0');
    if (first?.kind !== 'line') throw new Error('expected a line');
    const [a, b] = first.points;
    // Perpendicular to travel: the nosing runs across y, not along x.
    expect(a?.x).toBeCloseTo(0, 9);
    expect(b?.x).toBeCloseTo(0, 9);
    expect(Math.abs((b?.y ?? 0) - (a?.y ?? 0))).toBeCloseTo(1100, 9);
  });
});

import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  furnishingDetailPrimitives,
  furnishingPrimitives,
  pathwayPrimitives,
  servicePointPrimitives,
  slabPrimitives,
  stairPrimitives,
} from './plan-placed-content';

const RECTANGLE = [
  worldPoint(16_400, 500),
  worldPoint(17_500, 500),
  worldPoint(17_500, 3020),
  worldPoint(16_400, 3020),
];

describe('furnishingPrimitives', () => {
  /**
   * This asserted the opposite until the render was put beside the fixture's
   * own coordinated drawings, which fill their furniture and are the more
   * readable for it. The reasoning against filling - that 140 filled shapes
   * would hide the plan - turned out to be wrong about the drawing it was
   * protecting: an outlined wardrobe against an outlined wall is two rectangles
   * sharing an edge, and a filled one is plainly an object standing there.
   */
  it('fills the body and tints it with the stated material', () => {
    const [primitive, ...rest] = furnishingPrimitives({
      id: 'it-desk',
      footprint: RECTANGLE,
      material: 'wood',
    });
    expect(rest).toEqual([]);
    expect(primitive?.kind).toBe('polygon');
    if (primitive?.kind !== 'polygon') return;
    expect(primitive.fill).toBe('furnishing');
    expect(primitive.fillTint).toBe('wood');
  });

  /**
   * A material the file does not state leaves the tint off entirely, rather
   * than naming one. `canvas2d-paint` draws an untinted furnishing as its
   * outline, which says "a thing is here" without claiming what it is made of.
   */
  it('leaves the tint off when the file states no material', () => {
    for (const material of [null, undefined]) {
      const [primitive] = furnishingPrimitives({
        id: 'it-desk',
        footprint: RECTANGLE,
        ...(material === undefined ? {} : { material }),
      });
      if (primitive?.kind !== 'polygon') throw new Error('expected a polygon');
      expect(primitive.fillTint).toBeUndefined();
    }
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

describe('servicePointPrimitives', () => {
  const at = worldPoint(2400, 1900);

  /**
   * Shape, not colour, and not a label. Colour alone fails the design system's
   * rule that status may not be carried by hue; a label at 126 points buries
   * the plan. So the four disciplines have to be tellable apart by outline.
   */
  it('gives each discipline a distinguishable symbol', () => {
    const shapes = (['lighting', 'electrical', 'plumbing', 'hvac'] as const).map((discipline) =>
      servicePointPrimitives({ id: 'p', discipline, position: at })
        .map((entry) => `${entry.kind}:${entry.kind === 'polygon' ? entry.points.length : 'n'}`)
        .join('|'),
    );
    expect(new Set(shapes).size).toBe(4);
  });

  it('centres every symbol on the point it describes', () => {
    for (const discipline of ['lighting', 'electrical', 'plumbing', 'hvac'] as const) {
      const [body] = servicePointPrimitives({ id: 'p', discipline, position: at });
      if (body?.kind !== 'polygon') throw new Error('expected a polygon body');
      const cx = body.points.reduce((sum, p) => sum + p.x, 0) / body.points.length;
      const cy = body.points.reduce((sum, p) => sum + p.y, 0) / body.points.length;
      expect(cx).toBeCloseTo(2400, 6);
      expect(cy).toBeCloseTo(1900, 6);
    }
  });

  it('carries the point’s own id on its body, so a click selects the fitting', () => {
    const [body] = servicePointPrimitives({ id: 'lt-study', discipline: 'lighting', position: at });
    expect(body?.elementId).toBe('lt-study');
  });
});

describe('pathwayPrimitives', () => {
  it('draws the route as one polyline through every stated point', () => {
    const [line, ...rest] = pathwayPrimitives({
      id: 'p17-entry',
      points: [worldPoint(9000, -900), worldPoint(9000, 900), worldPoint(9000, 4200)],
    });
    expect(rest).toEqual([]);
    expect(line?.kind).toBe('line');
    if (line?.kind !== 'line') return;
    expect(line.points).toHaveLength(3);
  });

  it('draws nothing for a route with a single point', () => {
    expect(pathwayPrimitives({ id: 'p', points: [worldPoint(0, 0)] })).toEqual([]);
  });
});

describe('furnishingDetailPrimitives', () => {
  /** A WC 700 wide by 750 deep, against a wall to its north, facing south. */
  const wc = {
    id: 'it-gf-bath-wc',
    footprint: [
      worldPoint(1000, 2000),
      worldPoint(1700, 2000),
      worldPoint(1700, 2750),
      worldPoint(1000, 2750),
    ],
    kind: 'toilet',
    facingDirection: 'south',
  };

  it('draws a cistern and a pan for a WC', () => {
    const ids = furnishingDetailPrimitives(wc).map((entry) => entry.elementId);
    expect(ids).toEqual(['it-gf-bath-wc-cistern', 'it-gf-bath-wc-pan']);
  });

  /**
   * The whole point of reading `facingDirection`. A cistern belongs against the
   * wall; the pan sits in front of it. Facing south means the back is at the
   * north edge - the higher y - and a wrongly-oriented WC looks deliberate.
   */
  it('puts the cistern at the back, away from the way the fitting faces', () => {
    const [cistern, pan] = furnishingDetailPrimitives(wc);
    if (cistern?.kind !== 'polygon' || pan?.kind !== 'polygon')
      throw new Error('expected polygons');
    const centre = (p: typeof cistern) =>
      p.points.reduce((sum, point) => sum + point.y, 0) / p.points.length;
    // Facing south, so the back is north: the cistern sits at higher y.
    expect(centre(cistern)).toBeGreaterThan(centre(pan));
  });

  it('flips the cistern to the other edge for a fitting facing north', () => {
    const [cistern, pan] = furnishingDetailPrimitives({ ...wc, facingDirection: 'north' });
    if (cistern?.kind !== 'polygon' || pan?.kind !== 'polygon')
      throw new Error('expected polygons');
    const centre = (p: typeof cistern) =>
      p.points.reduce((sum, point) => sum + point.y, 0) / p.points.length;
    expect(centre(cistern)).toBeLessThan(centre(pan));
  });

  /**
   * The glyph is built in the footprint's own frame, so a rotated item's symbol
   * rotates with it without the glyph ever seeing a world axis. This fixture's
   * four WCs are all at 90 degrees.
   */
  it('keeps the glyph inside a rotated footprint', () => {
    const angle = Math.PI / 4;
    const centre = { x: 1350, y: 2375 };
    const rotated = wc.footprint.map((p) => {
      const dx = p.x - centre.x;
      const dy = p.y - centre.y;
      return worldPoint(
        centre.x + dx * Math.cos(angle) - dy * Math.sin(angle),
        centre.y + dx * Math.sin(angle) + dy * Math.cos(angle),
      );
    });
    for (const primitive of furnishingDetailPrimitives({ ...wc, footprint: rotated })) {
      if (primitive.kind !== 'polygon') continue;
      for (const point of primitive.points) {
        // Inside the rotated footprint's circumcircle, which a glyph escaping
        // into the room next door would not be.
        expect(Math.hypot(point.x - centre.x, point.y - centre.y)).toBeLessThan(600);
      }
    }
  });

  it('draws four burners for a hob and two bowls for a double vanity', () => {
    const box = [worldPoint(0, 0), worldPoint(900, 0), worldPoint(900, 600), worldPoint(0, 600)];
    expect(
      furnishingDetailPrimitives({
        id: 'h',
        footprint: box,
        kind: 'hob',
        facingDirection: 'north',
      }),
    ).toHaveLength(4);
    expect(
      furnishingDetailPrimitives({
        id: 'v',
        footprint: box,
        kind: 'double-vanity',
        facingDirection: 'south',
      }),
    ).toHaveLength(4);
  });

  /**
   * A kind with no conventional symbol keeps its filled body and gets nothing
   * else. Inventing a glyph for a media console would teach a reader a
   * vocabulary that exists nowhere else.
   */
  it('draws nothing for a kind with no conventional symbol', () => {
    const box = [worldPoint(0, 0), worldPoint(900, 0), worldPoint(900, 600), worldPoint(0, 600)];
    expect(furnishingDetailPrimitives({ id: 'm', footprint: box, kind: 'media-console' })).toEqual(
      [],
    );
    expect(furnishingDetailPrimitives({ id: 'm', footprint: box })).toEqual([]);
  });
});

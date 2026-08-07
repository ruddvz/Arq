import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  planOpening,
  planOpeningsForWall,
  swingPolyline,
  wallPiers,
  type PlanWallHost,
} from './plan-openings';

/**
 * A horizontal wall running east along y = 0, 250 mm thick. Chosen because
 * every expected coordinate below can be worked out by hand: along the wall is
 * +x, the left-hand normal is +y, and the faces sit at y = ±125.
 */
const EAST_WALL: PlanWallHost = {
  start: worldPoint(0, 0),
  end: worldPoint(10_000, 0),
  thickness: 250,
};

/** The same wall drawn the other way, to check that "left" follows the wall, not the page. */
const WEST_WALL: PlanWallHost = {
  start: worldPoint(10_000, 0),
  end: worldPoint(0, 0),
  thickness: 250,
};

function close(actual: number, expected: number, tolerance = 1e-9): void {
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
}

describe('planOpening', () => {
  it('cuts a reveal spanning the opening along the wall and the whole thickness across it', () => {
    const opening = planOpening(EAST_WALL, {
      id: 'o1',
      kind: 'window',
      offsetFromWallStart: 1000,
      width: 1800,
    });

    if (opening === null) throw new Error('expected a placed opening');
    expect(opening.reveal).toHaveLength(4);
    const xs = opening.reveal.map((p) => p.x).sort((a, b) => a - b);
    const ys = opening.reveal.map((p) => p.y).sort((a, b) => a - b);
    // Along: exactly the opening. Across: exactly the wall, both faces.
    expect(xs).toEqual([1000, 1000, 2800, 2800]);
    expect(ys).toEqual([-125, -125, 125, 125]);
  });

  it('closes the poche with a jamb at each end of the reveal', () => {
    const opening = planOpening(EAST_WALL, {
      id: 'o1',
      kind: 'window',
      offsetFromWallStart: 1000,
      width: 1800,
    });

    if (opening === null) throw new Error('expected a placed opening');
    expect(opening.jambs).toHaveLength(2);
    // A jamb crosses the wall; it does not run along it.
    for (const jamb of opening.jambs) {
      close(jamb.start.x, jamb.end.x);
      close(Math.abs(jamb.start.y - jamb.end.y), EAST_WALL.thickness);
    }
  });

  it('draws window glazing on the centreline, not on the faces', () => {
    const opening = planOpening(EAST_WALL, {
      id: 'o1',
      kind: 'window',
      offsetFromWallStart: 1000,
      width: 1800,
    });

    if (opening === null) throw new Error('expected a placed opening');
    expect(opening.glazing).toHaveLength(1);
    // On a face it would read as the wall continuing through the opening, which
    // is the one thing the reveal exists to deny.
    close(opening.glazing[0]!.start.y, 0);
    close(opening.glazing[0]!.end.y, 0);
    expect(opening.leaf).toBeNull();
    expect(opening.swing).toBeNull();
  });

  describe('a door leaf', () => {
    const door = {
      id: 'd1',
      kind: 'door',
      offsetFromWallStart: 1000,
      width: 900,
      side: 'left',
      hand: 'left',
      swingAngle: 90,
    } as const;

    it('hinges on the wall centreline, not on a face', () => {
      const opening = planOpening(EAST_WALL, door);
      if (opening === null || opening.swing === null) throw new Error('expected a swing');
      // Off the centreline the leaf would pivot half a wall thickness from
      // where it actually turns.
      close(opening.swing.centre.y, 0);
      close(opening.swing.centre.x, 1000);
    });

    it('opens to the side the model asked for, a quarter turn from closed', () => {
      const opening = planOpening(EAST_WALL, door);
      if (opening === null || opening.leaf === null) throw new Error('expected a leaf');
      // Hinged at the near jamb, closed pointing +x, swinging left (+y) by 90
      // degrees: the leaf ends one width directly "above" the hinge.
      close(opening.leaf.end.x, 1000);
      close(opening.leaf.end.y, 900);
    });

    it('opens the other way when the side flips, and nothing else moves', () => {
      const left = planOpening(EAST_WALL, door);
      const right = planOpening(EAST_WALL, { ...door, side: 'right' });
      if (left === null || left.leaf === null || right === null || right.leaf === null)
        throw new Error('expected leaves');

      close(right.leaf.end.x, 1000);
      close(right.leaf.end.y, -900);
      // The hole itself is the same hole; only the leaf changed.
      expect(right.reveal).toEqual(left.reveal);
    });

    it('hinges at the far jamb when the hand flips', () => {
      const opening = planOpening(EAST_WALL, { ...door, hand: 'right' });
      if (opening === null || opening.swing === null) throw new Error('expected a swing');
      close(opening.swing.centre.x, 1900);
    });

    it('measures the side from the wall direction, not from the page', () => {
      // The same stretch of wall, reached from each end.
      const east = planOpening(EAST_WALL, door);
      const west = planOpening(WEST_WALL, { ...door, offsetFromWallStart: 8100 });
      if (east === null || east.leaf === null || west === null || west.leaf === null)
        throw new Error('expected leaves');

      // East wall runs +x, so its left normal is +y. West wall runs -x, so its
      // left normal is -y. A door declared "left" on each therefore opens to
      // opposite sides of the page, which is what makes the field mean
      // something a wall's drawing direction cannot change.
      expect(Math.sign(east.leaf.end.y)).toBe(1);
      expect(Math.sign(west.leaf.end.y)).toBe(-1);
    });

    it('sweeps only as far as the model says', () => {
      const opening = planOpening(EAST_WALL, { ...door, swingAngle: 45 });
      if (opening === null || opening.swing === null || opening.leaf === null)
        throw new Error('expected a swing');

      const swept = opening.swing.endAngle - opening.swing.startAngle;
      close(swept, Math.PI / 4);
      close(Math.hypot(opening.leaf.end.x - 1000, opening.leaf.end.y), 900);
    });

    it('reports the sweep direction, which a renderer needs to draw the arc the short way', () => {
      const left = planOpening(EAST_WALL, door);
      const right = planOpening(EAST_WALL, { ...door, side: 'right' });
      expect(left?.swing?.clockwise).toBe(false);
      expect(right?.swing?.clockwise).toBe(true);
    });
  });

  it('gives a void a hole and nothing in it', () => {
    const opening = planOpening(EAST_WALL, {
      id: 'v1',
      kind: 'void',
      offsetFromWallStart: 1000,
      width: 800,
    });

    if (opening === null) throw new Error('expected a placed opening');
    expect(opening.reveal).toHaveLength(4);
    expect(opening.jambs).toHaveLength(2);
    expect(opening.leaf).toBeNull();
    expect(opening.glazing).toEqual([]);
  });

  it('places an opening on a wall at an angle without distorting it', () => {
    const diagonal: PlanWallHost = {
      start: worldPoint(0, 0),
      end: worldPoint(3000, 4000),
      thickness: 200,
    };
    const opening = planOpening(diagonal, {
      id: 'o1',
      kind: 'window',
      offsetFromWallStart: 1000,
      width: 1000,
    });

    if (opening === null) throw new Error('expected a placed opening');
    // The reveal is a rectangle whatever the wall's angle: its along-wall sides
    // measure the opening width and its across-wall sides the wall thickness.
    const [a, b, c] = opening.reveal;
    close(Math.hypot(b!.x - a!.x, b!.y - a!.y), 1000, 1e-6);
    close(Math.hypot(c!.x - b!.x, c!.y - b!.y), 200, 1e-6);
  });

  it('refuses to place an opening with no width, or on a wall with no length', () => {
    expect(
      planOpening(EAST_WALL, { id: 'o', kind: 'window', offsetFromWallStart: 0, width: 0 }),
    ).toBeNull();
    expect(
      planOpening(
        { start: worldPoint(5, 5), end: worldPoint(5, 5), thickness: 100 },
        { id: 'o', kind: 'window', offsetFromWallStart: 0, width: 900 },
      ),
    ).toBeNull();
  });
});

describe('planOpeningsForWall', () => {
  it('places every opening the wall hosts', () => {
    const placed = planOpeningsForWall(EAST_WALL, [
      { id: 'a', kind: 'window', offsetFromWallStart: 1000, width: 1800 },
      { id: 'b', kind: 'door', offsetFromWallStart: 5000, width: 900 },
    ]);
    expect(placed.map((opening) => opening.id)).toEqual(['a', 'b']);
  });

  it('drops one it cannot place rather than losing the rest of the drawing', () => {
    const placed = planOpeningsForWall(EAST_WALL, [
      { id: 'bad', kind: 'window', offsetFromWallStart: 1000, width: 0 },
      { id: 'good', kind: 'window', offsetFromWallStart: 2000, width: 900 },
    ]);
    expect(placed.map((opening) => opening.id)).toEqual(['good']);
  });
});

describe('wallPiers', () => {
  it('leaves the whole wall solid when nothing is cut from it', () => {
    const piers = wallPiers(EAST_WALL, []);
    expect(piers).toHaveLength(1);
    close(piers[0]!.start.x, 0);
    close(piers[0]!.end.x, 10_000);
  });

  it('splits the wall either side of an opening, so the opening is a gap and not a lid', () => {
    const piers = wallPiers(EAST_WALL, [
      { id: 'o', kind: 'door', offsetFromWallStart: 4000, width: 900 },
    ]);
    expect(piers).toHaveLength(2);
    close(piers[0]!.end.x, 4000);
    close(piers[1]!.start.x, 4900);
  });

  it('drops the pier entirely when an opening reaches a wall end', () => {
    const piers = wallPiers(EAST_WALL, [
      { id: 'o', kind: 'door', offsetFromWallStart: 0, width: 900 },
    ]);
    expect(piers).toHaveLength(1);
    close(piers[0]!.start.x, 900);
  });

  it('merges overlapping openings into one hole rather than emitting a negative pier', () => {
    const piers = wallPiers(EAST_WALL, [
      { id: 'a', kind: 'window', offsetFromWallStart: 1000, width: 1000 },
      { id: 'b', kind: 'window', offsetFromWallStart: 1500, width: 1000 },
    ]);
    expect(piers).toHaveLength(2);
    close(piers[0]!.end.x, 1000);
    close(piers[1]!.start.x, 2500);
  });

  it('keeps the piers in order when the openings are not', () => {
    const piers = wallPiers(EAST_WALL, [
      { id: 'b', kind: 'window', offsetFromWallStart: 6000, width: 900 },
      { id: 'a', kind: 'window', offsetFromWallStart: 2000, width: 900 },
    ]);
    expect(piers.map((pier) => Math.round(pier.start.x))).toEqual([0, 2900, 6900]);
  });
});

describe('swingPolyline', () => {
  it('traces the arc from closed to open, every point at the leaf radius', () => {
    const opening = planOpening(EAST_WALL, {
      id: 'd',
      kind: 'door',
      offsetFromWallStart: 1000,
      width: 900,
      side: 'left',
      hand: 'left',
      swingAngle: 90,
    });
    if (opening === null || opening.swing === null) throw new Error('expected a swing');

    const points = swingPolyline(opening.swing);
    expect(points.length).toBeGreaterThan(2);
    for (const point of points) {
      close(Math.hypot(point.x - 1000, point.y - 0), 900, 1e-6);
    }
    // Starts closed against the wall and ends at the open leaf.
    close(points[0]!.x, 1900, 1e-6);
    close(points[points.length - 1]!.y, 900, 1e-6);
  });
});

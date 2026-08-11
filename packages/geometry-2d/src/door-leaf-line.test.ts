import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { doorLeafPlacement } from './door-leaf-line';
import type { Segment } from './segment';

/** A 4m wall running east along y = 0, so world axes and wall axes coincide. */
const EAST: Segment = { start: worldPoint(0, 0), end: worldPoint(4000, 0) };

describe('doorLeafPlacement', () => {
  it('hinges a right-handed door at the far jamb', () => {
    const placement = doorLeafPlacement(EAST, { offsetFromWallStart: 1000, width: 900 });
    expect(placement?.hinge).toEqual(worldPoint(1900, 0));
  });

  it('hinges a left-handed door at the near jamb', () => {
    const placement = doorLeafPlacement(EAST, {
      offsetFromWallStart: 1000,
      width: 900,
      hand: 'left',
    });
    expect(placement?.hinge).toEqual(worldPoint(1000, 0));
  });

  it('swings a right-opening leaf to the right of the direction of travel', () => {
    // Looking east, "right" is -y, so the tip lands south of the hinge.
    const placement = doorLeafPlacement(EAST, { offsetFromWallStart: 1000, width: 900 });
    expect(placement?.tip.x).toBeCloseTo(1900, 6);
    expect(placement?.tip.y).toBeCloseTo(-900, 6);
  });

  it('swings a left-opening leaf the other way', () => {
    const placement = doorLeafPlacement(EAST, {
      offsetFromWallStart: 1000,
      width: 900,
      side: 'left',
    });
    expect(placement?.tip.y).toBeCloseTo(900, 6);
  });

  it('opens to the side it names whichever jamb it hangs from', () => {
    // The defect this pins: the sweep's sign was decided from `side` alone, and
    // a leaf hinged at the far jamb starts pointing back down the wall, so the
    // same signed rotation carried it to the opposite face. Two doors differing
    // only in hand opened to opposite sides of the wall, and since the default
    // hand is `right`, the default was the wrong one.
    for (const side of ['left', 'right'] as const) {
      const expected = side === 'left' ? 1 : -1;
      for (const hand of ['left', 'right'] as const) {
        const placement = doorLeafPlacement(EAST, {
          offsetFromWallStart: 1000,
          width: 900,
          side,
          hand,
        });
        expect(Math.sign(placement!.tip.y)).toBe(expected);
      }
    }
  });

  it('reports the sweep direction the plan arc has to be drawn in', () => {
    // `clockwise` is read to draw the arc the short way round, so it has to
    // follow the actual rotation rather than the named side - and once the hand
    // decides the sign, the two stop agreeing for half the doors.
    const nearJamb = doorLeafPlacement(EAST, {
      offsetFromWallStart: 1000,
      width: 900,
      side: 'left',
      hand: 'left',
    });
    const farJamb = doorLeafPlacement(EAST, {
      offsetFromWallStart: 1000,
      width: 900,
      side: 'left',
      hand: 'right',
    });
    expect(nearJamb?.clockwise).toBe(false);
    expect(farJamb?.clockwise).toBe(true);
  });

  it('lays a zero-swing leaf along the wall, closed in its own opening', () => {
    // The one placement where the leaf fills the reveal rather than standing out
    // of it - and the reason the tip is checked rather than only the angle: a
    // closed right-handed leaf runs from the far jamb back to the near one.
    const placement = doorLeafPlacement(EAST, {
      offsetFromWallStart: 1000,
      width: 900,
      swingAngle: 0,
    });
    expect(placement?.tip.x).toBeCloseTo(1000, 6);
    expect(placement?.tip.y).toBeCloseTo(0, 6);
  });

  it('measures the tip at the leaf width from the hinge, whatever the swing', () => {
    for (const swingAngle of [15, 45, 90, 135, 180]) {
      const placement = doorLeafPlacement(EAST, {
        offsetFromWallStart: 500,
        width: 826,
        swingAngle,
      });
      expect(placement).not.toBeNull();
      const radius = Math.hypot(
        placement!.tip.x - placement!.hinge.x,
        placement!.tip.y - placement!.hinge.y,
      );
      expect(radius).toBeCloseTo(826, 6);
    }
  });

  it('states side and hand relative to the wall, not to the world', () => {
    // The same door on the same physical wall drawn in the opposite direction.
    // Right-handed and right-opening are defined looking along the wall from its
    // start, so reversing the wall must move the leaf to the other jamb and the
    // other face - not leave it where it was.
    const forward = doorLeafPlacement(EAST, { offsetFromWallStart: 1000, width: 900 });
    const reversed = doorLeafPlacement(
      { start: EAST.end, end: EAST.start },
      { offsetFromWallStart: 1000, width: 900 },
    );
    expect(reversed?.hinge).toEqual(worldPoint(2100, 0));
    expect(forward?.tip.y).toBeCloseTo(-900, 6);
    expect(reversed?.tip.y).toBeCloseTo(900, 6);
  });

  it('returns null for a wall with no length or an opening with no width', () => {
    const degenerate: Segment = { start: worldPoint(10, 10), end: worldPoint(10, 10) };
    expect(doorLeafPlacement(degenerate, { offsetFromWallStart: 0, width: 900 })).toBeNull();
    expect(doorLeafPlacement(EAST, { offsetFromWallStart: 0, width: 0 })).toBeNull();
    expect(doorLeafPlacement(EAST, { offsetFromWallStart: 0, width: -900 })).toBeNull();
  });

  it('returns null for a non-finite offset or width (adversarial: non-finite values)', () => {
    expect(doorLeafPlacement(EAST, { offsetFromWallStart: Number.NaN, width: 900 })).toBeNull();
    expect(
      doorLeafPlacement(EAST, { offsetFromWallStart: 0, width: Number.POSITIVE_INFINITY }),
    ).toBeNull();
  });
});

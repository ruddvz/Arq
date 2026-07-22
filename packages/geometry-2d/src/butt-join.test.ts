import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { buttJoinPoint } from './butt-join';

// a horizontal "through" wall along the x-axis, thickness 2, centre-aligned
// (so its faces sit at y=+1 and y=-1).
const throughWall = { start: worldPoint(0, 0), end: worldPoint(20, 0) };

describe('buttJoinPoint', () => {
  it("trims a butting wall approaching from above (+y) to the through wall's top face", () => {
    // a vertical wall coming down from (10, 10) towards the through wall.
    const buttingWall = { start: worldPoint(10, 10), end: worldPoint(10, 2) };
    const point = buttJoinPoint(throughWall, 2, 'centre', buttingWall, 1e-9);
    expect(point?.x).toBeCloseTo(10, 9);
    expect(point?.y).toBeCloseTo(1, 9);
  });

  it("trims a butting wall approaching from below (-y) to the through wall's bottom face", () => {
    const buttingWall = { start: worldPoint(10, -10), end: worldPoint(10, -2) };
    const point = buttJoinPoint(throughWall, 2, 'centre', buttingWall, 1e-9);
    expect(point?.x).toBeCloseTo(10, 9);
    expect(point?.y).toBeCloseTo(-1, 9);
  });

  it("does not modify the through wall - only ever returns a point on the butting wall's line", () => {
    const buttingWall = { start: worldPoint(10, 10), end: worldPoint(10, 2) };
    const point = buttJoinPoint(throughWall, 2, 'centre', buttingWall, 1e-9)!;
    // the trim point must lie on the butting wall's (vertical) line, i.e. x is unchanged.
    expect(point.x).toBeCloseTo(buttingWall.start.x, 9);
  });

  it('respects interior/exterior alignment (asymmetric thickness offset) when picking the near face', () => {
    const buttingWall = { start: worldPoint(10, 10), end: worldPoint(10, 2) };
    const point = buttJoinPoint(throughWall, 2, 'interior', buttingWall, 1e-9);
    // interior alignment puts the entire thickness on the left (+y) side,
    // so the top face is at y=2, not y=1.
    expect(point?.y).toBeCloseTo(2, 9);
  });

  it('returns null when the butting wall runs parallel to the through wall (no trim point exists)', () => {
    const parallelButtingWall = { start: worldPoint(0, 5), end: worldPoint(10, 5) };
    expect(buttJoinPoint(throughWall, 2, 'centre', parallelButtingWall, 1e-9)).toBeNull();
  });

  it('returns null for a degenerate through-wall centerline (adversarial: zero-length segments)', () => {
    const degenerateThrough = { start: worldPoint(5, 5), end: worldPoint(5, 5) };
    const buttingWall = { start: worldPoint(10, 10), end: worldPoint(10, 2) };
    expect(buttJoinPoint(degenerateThrough, 2, 'centre', buttingWall, 1e-9)).toBeNull();
  });

  it('returns null for a non-positive through-wall thickness', () => {
    const buttingWall = { start: worldPoint(10, 10), end: worldPoint(10, 2) };
    expect(buttJoinPoint(throughWall, 0, 'centre', buttingWall, 1e-9)).toBeNull();
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const offset = 1_000_000;
    const farThrough = { start: worldPoint(offset, offset), end: worldPoint(offset + 20, offset) };
    const farButting = {
      start: worldPoint(offset + 10, offset + 10),
      end: worldPoint(offset + 10, offset + 2),
    };
    const point = buttJoinPoint(farThrough, 2, 'centre', farButting, 1e-6);
    expect(point?.x).toBeCloseTo(offset + 10, 3);
    expect(point?.y).toBeCloseTo(offset + 1, 3);
  });
});

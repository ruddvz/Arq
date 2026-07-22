import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { tJoinPoint } from './t-join';

const throughWall = { start: worldPoint(0, 0), end: worldPoint(20, 0) };

describe('tJoinPoint', () => {
  it('finds the junction when the stem meets the through wall strictly within its span', () => {
    const stem = { start: worldPoint(10, 10), end: worldPoint(10, 2) };
    const point = tJoinPoint(throughWall, 2, 'centre', stem, 1e-9);
    expect(point?.x).toBeCloseTo(10, 9);
    expect(point?.y).toBeCloseTo(1, 9);
  });

  it("returns null when the junction would fall beyond the through wall's own end (not a true T)", () => {
    // the stem meets where the through wall's line extends, well past its own end at x=20.
    const stem = { start: worldPoint(30, 10), end: worldPoint(30, 2) };
    expect(tJoinPoint(throughWall, 2, 'centre', stem, 1e-9)).toBeNull();
  });

  it("returns null exactly at the through wall's endpoint (that is a corner, not a T)", () => {
    const stem = { start: worldPoint(0, 10), end: worldPoint(0, 2) };
    expect(tJoinPoint(throughWall, 2, 'centre', stem, 1e-9)).toBeNull();
  });

  it('returns null for a degenerate through-wall centerline (adversarial: zero-length segments)', () => {
    const degenerateThrough = { start: worldPoint(5, 5), end: worldPoint(5, 5) };
    const stem = { start: worldPoint(10, 10), end: worldPoint(10, 2) };
    expect(tJoinPoint(degenerateThrough, 2, 'centre', stem, 1e-9)).toBeNull();
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const offset = 1_000_000;
    const farThrough = { start: worldPoint(offset, offset), end: worldPoint(offset + 20, offset) };
    const farStem = {
      start: worldPoint(offset + 10, offset + 10),
      end: worldPoint(offset + 10, offset + 2),
    };
    const point = tJoinPoint(farThrough, 2, 'centre', farStem, 1e-6);
    expect(point?.x).toBeCloseTo(offset + 10, 3);
    expect(point?.y).toBeCloseTo(offset + 1, 3);
  });
});

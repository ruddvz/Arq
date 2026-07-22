import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { closestPointOnSegment } from './nearest-point';

describe('closestPointOnSegment', () => {
  it('returns the perpendicular foot when it lands within the segment', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    expect(closestPointOnSegment(segment, worldPoint(5, 3))).toEqual(worldPoint(5, 0));
  });

  it('clamps to the nearer endpoint when the projection falls outside the segment', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    expect(closestPointOnSegment(segment, worldPoint(-5, 3))).toEqual(worldPoint(0, 0));
    expect(closestPointOnSegment(segment, worldPoint(15, 3))).toEqual(worldPoint(10, 0));
  });

  it('returns the single point for a zero-length segment (adversarial: zero-length segments)', () => {
    const segment = { start: worldPoint(3, 3), end: worldPoint(3, 3) };
    expect(closestPointOnSegment(segment, worldPoint(10, 10))).toEqual(worldPoint(3, 3));
  });

  it('gives the same result regardless of which endpoint is start vs end (adversarial: reversed segment order)', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const reversed = { start: segment.end, end: segment.start };
    const point = worldPoint(3, 4);
    expect(closestPointOnSegment(reversed, point)).toEqual(closestPointOnSegment(segment, point));
  });

  it('handles large world coordinates without precision collapse (adversarial: large world coordinates)', () => {
    const segment = { start: worldPoint(1_000_000, 0), end: worldPoint(1_000_010, 0) };
    const result = closestPointOnSegment(segment, worldPoint(1_000_005, 7));
    expect(result.x).toBeCloseTo(1_000_005, 6);
    expect(result.y).toBeCloseTo(0, 6);
  });

  it('handles coordinates near zero without a sign error (adversarial: values near zero)', () => {
    const segment = { start: worldPoint(-1e-8, 0), end: worldPoint(1e-8, 0) };
    const result = closestPointOnSegment(segment, worldPoint(0, 1e-9));
    expect(result.x).toBeCloseTo(0, 12);
    expect(result.y).toBeCloseTo(0, 12);
  });
});

import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { lineIntersection } from './line-intersection';

describe('lineIntersection', () => {
  it('finds the crossing point of two perpendicular lines', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    const result = lineIntersection(a, b, 1e-9);
    expect(result?.x).toBeCloseTo(5, 9);
    expect(result?.y).toBeCloseTo(0, 9);
  });

  it("finds a crossing point beyond either input segment's own bounds - unlike segmentIntersection", () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(1, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, -1) };
    const result = lineIntersection(a, b, 1e-9);
    expect(result?.x).toBeCloseTo(5, 9);
    expect(result?.y).toBeCloseTo(0, 9);
  });

  it('returns null for parallel lines', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(0, 5), end: worldPoint(10, 5) };
    expect(lineIntersection(a, b, 1e-9)).toBeNull();
  });

  it('returns null for a zero-length input (adversarial: zero-length segments)', () => {
    const a = { start: worldPoint(5, 5), end: worldPoint(5, 5) };
    const b = { start: worldPoint(0, 0), end: worldPoint(10, 10) };
    expect(lineIntersection(a, b, 1e-9)).toBeNull();
  });

  it('gives the same result regardless of which endpoint is start vs end (adversarial: reversed segment order)', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    const forward = lineIntersection(a, b, 1e-9);
    const reversed = lineIntersection(
      { start: a.end, end: a.start },
      { start: b.end, end: b.start },
      1e-9,
    );
    expect(reversed?.x).toBeCloseTo(forward!.x, 9);
    expect(reversed?.y).toBeCloseTo(forward!.y, 9);
  });

  it('returns null for a non-finite endpoint (adversarial: non-finite values)', () => {
    const a = { start: worldPoint(NaN, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    expect(lineIntersection(a, b, 1e-9)).toBeNull();
  });

  it('returns null for an invalid tolerance', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    expect(lineIntersection(a, b, -1)).toBeNull();
    expect(lineIntersection(a, b, NaN)).toBeNull();
  });
});

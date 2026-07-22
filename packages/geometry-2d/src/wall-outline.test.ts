import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { polygonArea, windingOf } from './polygon-area';
import { wallOutline } from './wall-outline';

const horizontalWall = { start: worldPoint(0, 0), end: worldPoint(10, 0) };

describe('wallOutline', () => {
  it('produces a rectangle whose area equals thickness times length, for every alignment', () => {
    for (const alignment of ['centre', 'interior', 'exterior'] as const) {
      const outline = wallOutline(horizontalWall, 2, alignment, 1e-9);
      expect(outline).not.toBeNull();
      expect(polygonArea(outline!)).toBeCloseTo(20, 9);
    }
  });

  it('centre alignment straddles the centerline evenly on both sides', () => {
    const outline = wallOutline(horizontalWall, 2, 'centre', 1e-9)!;
    const ys = outline.map((p) => p.y).sort((a, b) => a - b);
    expect(ys).toEqual([-1, -1, 1, 1]);
  });

  it('interior alignment offsets the entire thickness to the left of the direction', () => {
    // direction is +x, so "left" (rotated +90 degrees CCW) is +y.
    const outline = wallOutline(horizontalWall, 2, 'interior', 1e-9)!;
    const ys = outline.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(0, 9);
    expect(Math.max(...ys)).toBeCloseTo(2, 9);
  });

  it('exterior alignment offsets the entire thickness to the right of the direction', () => {
    const outline = wallOutline(horizontalWall, 2, 'exterior', 1e-9)!;
    const ys = outline.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(-2, 9);
    expect(Math.max(...ys)).toBeCloseTo(0, 9);
  });

  it('produces a non-degenerate, consistent winding for every alignment', () => {
    for (const alignment of ['centre', 'interior', 'exterior'] as const) {
      const outline = wallOutline(horizontalWall, 2, alignment, 1e-9)!;
      expect(windingOf(outline, 1e-9)).not.toBe('degenerate');
    }
  });

  it('returns null for a zero-length centerline (adversarial: zero-length segments)', () => {
    const zeroLength = { start: worldPoint(5, 5), end: worldPoint(5, 5) };
    expect(wallOutline(zeroLength, 2, 'centre', 1e-9)).toBeNull();
  });

  it('returns null for a near-zero-length centerline within tolerance', () => {
    const nearZero = { start: worldPoint(0, 0), end: worldPoint(1e-10, 0) };
    expect(wallOutline(nearZero, 2, 'centre', 1e-6)).toBeNull();
  });

  it('returns null for a non-positive thickness', () => {
    expect(wallOutline(horizontalWall, 0, 'centre', 1e-9)).toBeNull();
    expect(wallOutline(horizontalWall, -1, 'centre', 1e-9)).toBeNull();
  });

  it('returns null for an invalid tolerance', () => {
    expect(wallOutline(horizontalWall, 2, 'centre', -1)).toBeNull();
    expect(wallOutline(horizontalWall, 2, 'centre', NaN)).toBeNull();
  });

  it('still produces the correct area for an extremely thin wall (adversarial: extremely thin wall)', () => {
    const outline = wallOutline(horizontalWall, 1e-6, 'centre', 1e-9)!;
    expect(polygonArea(outline)).toBeCloseTo(10 * 1e-6, 12);
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const offset = 1_000_000;
    const farWall = { start: worldPoint(offset, offset), end: worldPoint(offset + 10, offset) };
    const outline = wallOutline(farWall, 2, 'centre', 1e-9)!;
    expect(polygonArea(outline)).toBeCloseTo(20, 6);
  });
});

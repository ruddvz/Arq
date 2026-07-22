import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { mitreJoinCorners } from './mitre-join';

describe('mitreJoinCorners', () => {
  it('mitres a 90-degree corner of two equal-thickness centre-aligned walls', () => {
    // wall A runs along +x from the origin; wall B runs along +y from the origin -
    // a classic L-shaped corner.
    const wallA = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const wallB = { start: worldPoint(0, 0), end: worldPoint(0, 10) };
    const corners = mitreJoinCorners(wallA, 2, 'centre', wallB, 2, 'centre', 1e-9);
    expect(corners.left).not.toBeNull();
    expect(corners.right).not.toBeNull();
    // for equal-thickness (2, so half-thickness 1) centre-aligned
    // perpendicular walls, each mitre corner sits at the diagonal offset
    // half-thickness * sqrt(2) from the shared corner point (0,0) - the
    // standard square-corner mitre distance.
    expect(Math.hypot(corners.left!.x, corners.left!.y)).toBeCloseTo(Math.SQRT2, 9);
    expect(Math.hypot(corners.right!.x, corners.right!.y)).toBeCloseTo(Math.SQRT2, 9);
    // the two corners are diagonally opposite each other.
    expect(corners.left).toEqual({ x: -1, y: 1 });
    expect(corners.right).toEqual({ x: 1, y: -1 });
  });

  it('gives independent left/right corners for differing wall thicknesses', () => {
    const wallA = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const wallB = { start: worldPoint(0, 0), end: worldPoint(0, 10) };
    const corners = mitreJoinCorners(wallA, 4, 'centre', wallB, 2, 'centre', 1e-9);
    expect(corners.left).not.toBeNull();
    expect(corners.right).not.toBeNull();
    expect(corners.left).not.toEqual(corners.right);
  });

  it('returns null for both corners when the two walls are parallel (no defined corner)', () => {
    const wallA = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const wallB = { start: worldPoint(0, 5), end: worldPoint(10, 5) };
    const corners = mitreJoinCorners(wallA, 2, 'centre', wallB, 2, 'centre', 1e-9);
    expect(corners.left).toBeNull();
    expect(corners.right).toBeNull();
  });

  it('returns null corners when one wall has a degenerate centerline (adversarial: zero-length segments)', () => {
    const wallA = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const degenerateB = { start: worldPoint(5, 5), end: worldPoint(5, 5) };
    const corners = mitreJoinCorners(wallA, 2, 'centre', degenerateB, 2, 'centre', 1e-9);
    expect(corners.left).toBeNull();
    expect(corners.right).toBeNull();
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const offset = 1_000_000;
    const wallA = { start: worldPoint(offset, offset), end: worldPoint(offset + 10, offset) };
    const wallB = { start: worldPoint(offset, offset), end: worldPoint(offset, offset + 10) };
    const corners = mitreJoinCorners(wallA, 2, 'centre', wallB, 2, 'centre', 1e-6);
    expect(corners.left).not.toBeNull();
    expect(corners.right).not.toBeNull();
  });
});

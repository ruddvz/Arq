import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { findIntersectionSnaps, segmentIntersection } from './intersection-snap';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

describe('segmentIntersection', () => {
  it('finds the crossing point of two perpendicular segments', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    expect(segmentIntersection(a, b)).toEqual(worldPoint(5, 0));
  });

  it('returns null for parallel segments', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(0, 5), end: worldPoint(10, 5) };
    expect(segmentIntersection(a, b)).toBeNull();
  });

  it('returns null when the lines would cross only outside both segments' + "' bounds", () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(1, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    expect(segmentIntersection(a, b)).toBeNull();
  });
});

describe('findIntersectionSnaps', () => {
  it('returns a snap result for a pair of segments crossing near the cursor', () => {
    const candidates = [
      { start: worldPoint(0, 0), end: worldPoint(10, 0) },
      { start: worldPoint(5, -5), end: worldPoint(5, 5) },
    ];
    const results = findIntersectionSnaps(candidates, worldPoint(5, 1), viewport, 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ source: 'intersection', point: { x: 5, y: 0 } });
  });

  it('tests every unique pair, not the same pair twice', () => {
    const candidates = [
      { start: worldPoint(0, 0), end: worldPoint(10, 0) },
      { start: worldPoint(5, -5), end: worldPoint(5, 5) },
      { start: worldPoint(0, 10), end: worldPoint(10, 10) }, // parallel to the first, no crossing
    ];
    const results = findIntersectionSnaps(candidates, worldPoint(5, 0), viewport, 10);
    expect(results).toHaveLength(1);
  });

  it('returns nothing when no pair crosses within tolerance', () => {
    const candidates = [
      { start: worldPoint(0, 0), end: worldPoint(10, 0) },
      { start: worldPoint(0, 5), end: worldPoint(10, 5) },
    ];
    expect(findIntersectionSnaps(candidates, worldPoint(5, 2.5), viewport, 10)).toEqual([]);
  });
});

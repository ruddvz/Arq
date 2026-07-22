import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { closestPointOnSegment, findNearestSnaps } from './nearest-snap';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

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

  it('returns the single point for a zero-length segment', () => {
    const segment = { start: worldPoint(3, 3), end: worldPoint(3, 3) };
    expect(closestPointOnSegment(segment, worldPoint(10, 10))).toEqual(worldPoint(3, 3));
  });
});

describe('findNearestSnaps', () => {
  it('snaps to the closest point on a segment, unlike perpendicular/extension it applies within the segment interior', () => {
    const candidates = [{ start: worldPoint(0, 0), end: worldPoint(10, 0) }];
    const results = findNearestSnaps(candidates, worldPoint(5, 1), viewport, 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ source: 'nearest', point: { x: 5, y: 0 } });
  });

  it('also matches beyond the segment bounds via endpoint clamping', () => {
    const candidates = [{ start: worldPoint(0, 0), end: worldPoint(10, 0) }];
    const results = findNearestSnaps(candidates, worldPoint(12, 0.5), viewport, 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ point: { x: 10, y: 0 } });
  });

  it('excludes a segment entirely outside tolerance', () => {
    const candidates = [{ start: worldPoint(0, 0), end: worldPoint(10, 0) }];
    expect(findNearestSnaps(candidates, worldPoint(5, 100), viewport, 10)).toEqual([]);
  });
});

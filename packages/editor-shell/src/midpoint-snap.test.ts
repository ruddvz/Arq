import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { findMidpointSnaps } from './midpoint-snap';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

describe('findMidpointSnaps', () => {
  it('snaps to the midpoint of a segment when the cursor is within tolerance', () => {
    const candidates = [{ start: worldPoint(0, 0), end: worldPoint(10, 0) }];
    const results = findMidpointSnaps(candidates, worldPoint(5, 1), viewport, 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ source: 'midpoint', point: { x: 5, y: 0 } });
  });

  it('excludes a segment whose midpoint is outside tolerance', () => {
    const candidates = [{ start: worldPoint(0, 0), end: worldPoint(10, 0) }];
    expect(findMidpointSnaps(candidates, worldPoint(5, 100), viewport, 10)).toEqual([]);
  });
});

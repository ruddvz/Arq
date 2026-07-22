import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { findEndpointSnaps } from './endpoint-snap';
import { pickBestSnap } from './snap-result';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

describe('findEndpointSnaps', () => {
  it('returns a snap result for a candidate within tolerance', () => {
    const candidates = [{ point: worldPoint(5, 0) }];
    const results = findEndpointSnaps(candidates, worldPoint(4, 0), viewport, 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      source: 'endpoint',
      point: { x: 5, y: 0 },
      screenDistance: 1,
    });
  });

  it('excludes a candidate outside tolerance', () => {
    const candidates = [{ point: worldPoint(100, 100) }];
    expect(findEndpointSnaps(candidates, worldPoint(0, 0), viewport, 10)).toEqual([]);
  });

  it('converts screen-pixel tolerance to world units using the current zoom level', () => {
    const candidates = [{ point: worldPoint(9, 0) }];
    // 9 world units away: within a 10px tolerance at 1px/unit, but not at 100px/unit (0.1 world units).
    expect(findEndpointSnaps(candidates, worldPoint(0, 0), viewport, 10)).toHaveLength(1);
    const zoomedIn: Viewport = { ...viewport, pixelsPerUnit: 100 };
    expect(findEndpointSnaps(candidates, worldPoint(0, 0), zoomedIn, 10)).toEqual([]);
  });

  it('returns a result per matching candidate, letting the caller pick the closest via pickBestSnap', () => {
    const candidates = [{ point: worldPoint(1, 0) }, { point: worldPoint(-2, 0) }];
    const results = findEndpointSnaps(candidates, worldPoint(0, 0), viewport, 10);
    expect(results).toHaveLength(2);
    expect(pickBestSnap(results)?.point).toEqual(worldPoint(1, 0));
  });
});

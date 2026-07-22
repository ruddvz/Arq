import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  boundsFromCorners,
  createPointRegionTestable,
  selectInRegion,
  type RegionCandidate,
} from './region-selection';

describe('boundsFromCorners', () => {
  it('normalizes two corners given in either order to a min/max box', () => {
    expect(boundsFromCorners(worldPoint(10, 10), worldPoint(0, 0))).toEqual({
      min: worldPoint(0, 0),
      max: worldPoint(10, 10),
    });
    expect(boundsFromCorners(worldPoint(0, 10), worldPoint(10, 0))).toEqual({
      min: worldPoint(0, 0),
      max: worldPoint(10, 10),
    });
  });
});

describe('selectInRegion with point candidates', () => {
  const candidates: readonly RegionCandidate<string>[] = [
    { id: 'inside', ...createPointRegionTestable(worldPoint(5, 5)) },
    { id: 'outside', ...createPointRegionTestable(worldPoint(50, 50)) },
    { id: 'on-edge', ...createPointRegionTestable(worldPoint(10, 5)) },
  ];
  const region = boundsFromCorners(worldPoint(0, 0), worldPoint(10, 10));

  it('window mode keeps only candidates inside the rectangle', () => {
    expect(selectInRegion(candidates, region, 'window')).toEqual(['inside', 'on-edge']);
  });

  it('crossing mode gives the identical result for zero-area point candidates', () => {
    // documented behaviour: a point has no extent, so window and crossing
    // selection cannot diverge for it - they only differ for shapes with
    // real extent, which don't exist as candidates yet.
    expect(selectInRegion(candidates, region, 'crossing')).toEqual(
      selectInRegion(candidates, region, 'window'),
    );
  });

  it('excludes a candidate entirely outside the rectangle in both modes', () => {
    expect(selectInRegion(candidates, region, 'window')).not.toContain('outside');
    expect(selectInRegion(candidates, region, 'crossing')).not.toContain('outside');
  });

  it('returns an empty array when no candidates match', () => {
    const farRegion = boundsFromCorners(worldPoint(1000, 1000), worldPoint(1010, 1010));
    expect(selectInRegion(candidates, farRegion, 'window')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { findGridSnap } from './grid-snap';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

describe('findGridSnap', () => {
  it('snaps to the nearest grid point within tolerance', () => {
    const result = findGridSnap(worldPoint(9.6, 0.2), 10, viewport, 10);
    expect(result).toMatchObject({ source: 'grid', point: { x: 10, y: 0 } });
  });

  it('returns undefined when the nearest grid point is outside tolerance', () => {
    expect(findGridSnap(worldPoint(5, 5), 10, viewport, 1)).toBeUndefined();
  });

  it('rejects a non-positive or non-finite grid spacing', () => {
    expect(() => findGridSnap(worldPoint(0, 0), 0, viewport)).toThrow(RangeError);
    expect(() => findGridSnap(worldPoint(0, 0), -5, viewport)).toThrow(RangeError);
    expect(() => findGridSnap(worldPoint(0, 0), Infinity, viewport)).toThrow(RangeError);
  });
});

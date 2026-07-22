import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { findPerpendicularSnaps, perpendicularFoot } from './perpendicular-snap';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

describe('perpendicularFoot', () => {
  it('finds the foot of the perpendicular from a point above a horizontal segment', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    expect(perpendicularFoot(segment, worldPoint(5, 3))).toEqual(worldPoint(5, 0));
  });

  it('returns null when the foot would fall outside the segment', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    expect(perpendicularFoot(segment, worldPoint(-5, 3))).toBeNull();
  });

  it('returns null for a zero-length segment', () => {
    const segment = { start: worldPoint(3, 3), end: worldPoint(3, 3) };
    expect(perpendicularFoot(segment, worldPoint(5, 5))).toBeNull();
  });
});

describe('findPerpendicularSnaps', () => {
  it('returns a snap result when the cursor is near the perpendicular foot', () => {
    const candidates = [{ start: worldPoint(0, 0), end: worldPoint(10, 0) }];
    const results = findPerpendicularSnaps(
      candidates,
      worldPoint(5, 3),
      worldPoint(5, 0.5),
      viewport,
      10,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ source: 'perpendicular', point: { x: 5, y: 0 } });
  });

  it('excludes a segment whose foot is outside tolerance of the cursor', () => {
    const candidates = [{ start: worldPoint(0, 0), end: worldPoint(10, 0) }];
    const results = findPerpendicularSnaps(
      candidates,
      worldPoint(5, 3),
      worldPoint(5, 100),
      viewport,
      10,
    );
    expect(results).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { findNearestRoomBoundaryGap } from './room-boundary-gap';
import type { RoomBoundaryEdge } from './room-boundary-graph';

function edge(
  id: string,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): RoomBoundaryEdge<string> {
  return { id, start: worldPoint(sx, sy), end: worldPoint(ex, ey) };
}

describe('findNearestRoomBoundaryGap', () => {
  it('finds the missing side of a square missing its west wall', () => {
    const walls = [edge('n', 0, 0, 10, 0), edge('e', 10, 0, 10, 10), edge('s', 10, 10, 0, 10)];
    const gap = findNearestRoomBoundaryGap(walls, 1e-6)!;
    expect(gap).not.toBeNull();
    expect(gap.distance).toBeCloseTo(10, 6);
    const endpoints = [gap.from, gap.to];
    expect(endpoints).toContainEqual(worldPoint(0, 0));
    expect(endpoints).toContainEqual(worldPoint(0, 10));
  });

  it('returns null for a fully closed loop (no dangling endpoint)', () => {
    const walls = [
      edge('n', 0, 0, 10, 0),
      edge('e', 10, 0, 10, 10),
      edge('s', 10, 10, 0, 10),
      edge('w', 0, 10, 0, 0),
    ];
    expect(findNearestRoomBoundaryGap(walls, 1e-6)).toBeNull();
  });

  it('finds the nearest gap between two disconnected wall segments', () => {
    const walls = [edge('a', 0, 0, 10, 0), edge('b', 10, 3, 20, 3)];
    const gap = findNearestRoomBoundaryGap(walls, 1e-6)!;
    expect(gap.distance).toBeCloseTo(3, 6);
  });

  it('suggests connecting to the nearest point on a wall, not just its endpoints', () => {
    // A dangling stub whose nearest connection point is the *middle* of
    // another wall, not either of that wall's own endpoints.
    const walls = [edge('main', 0, 0, 20, 0), edge('stub', 10, 5, 10, 1)];
    const gap = findNearestRoomBoundaryGap(walls, 1e-6)!;
    expect(gap.distance).toBeCloseTo(1, 6);
    expect(gap.to).toEqual(worldPoint(10, 0));
  });

  it('returns null for an empty edge list', () => {
    expect(findNearestRoomBoundaryGap([], 1e-6)).toBeNull();
  });

  it('returns null for a single degenerate (zero-length) edge', () => {
    expect(findNearestRoomBoundaryGap([edge('zero', 3, 3, 3, 3)], 1e-6)).toBeNull();
  });

  it('returns null for an invalid tolerance rather than a hidden fallback', () => {
    const walls = [edge('a', 0, 0, 10, 0)];
    expect(findNearestRoomBoundaryGap(walls, -1e-6)).toBeNull();
    expect(findNearestRoomBoundaryGap(walls, Number.NaN)).toBeNull();
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const offset = 1_000_000;
    const walls = [
      edge('n', offset, offset, offset + 10, offset),
      edge('e', offset + 10, offset, offset + 10, offset + 10),
      edge('s', offset + 10, offset + 10, offset, offset + 10),
    ];
    const gap = findNearestRoomBoundaryGap(walls, 1e-6)!;
    expect(gap.distance).toBeCloseTo(10, 3);
  });
});

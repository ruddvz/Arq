/**
 * Supporting primitive for ARQ-111 (room boundary graph): point-in-polygon,
 * one of the responsibilities blueprint section 39 lists for
 * @arq/geometry-2d that no earlier issue implemented yet.
 *
 * Single-ring only, same scope limit as polygon-area.ts (ARQ-085): a
 * polygon with a hole ("room containing island", section 42) is a
 * multi-ring concept this module does not model.
 *
 * A point exactly on the boundary (within tolerance) always counts as
 * inside, checked before the parity test - "a point on the boundary is
 * outside" would be a surprising, arbitrary answer for the near-degenerate
 * "opening touching wall end"-style cases section 42 asks regression
 * fixtures to cover, so this treats the boundary itself as part of the
 * enclosed region rather than picking a side.
 *
 * The interior test itself is the standard even-odd ray-casting
 * (crossing number) algorithm, cast along +x from the query point.
 */

import { closestPointOnSegment } from './nearest-point';
import type { WorldPoint } from './coordinate-system';

export function pointInPolygon(
  polygon: readonly WorldPoint[],
  point: WorldPoint,
  tolerance: number,
): boolean {
  if (polygon.length < 3 || !Number.isFinite(tolerance) || tolerance < 0) {
    return false;
  }

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const closest = closestPointOnSegment({ start: a, end: b }, point);
    if (Math.hypot(closest.x - point.x, closest.y - point.y) <= tolerance) {
      return true;
    }
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const vi = polygon[i]!;
    const vj = polygon[j]!;
    const crosses = vi.y > point.y !== vj.y > point.y;
    if (crosses) {
      const xAtPointY = ((vj.x - vi.x) * (point.y - vi.y)) / (vj.y - vi.y) + vi.x;
      if (point.x < xAtPointY) {
        inside = !inside;
      }
    }
  }
  return inside;
}

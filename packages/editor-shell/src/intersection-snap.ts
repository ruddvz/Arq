/**
 * ARQ-048: intersection snap.
 *
 * Snaps to the point where two segment candidates actually cross each
 * other *within their bounds* - not where their infinite extensions would
 * cross (that is extension-snap.ts's concern, ARQ-051). Every unique pair
 * of candidates is tested; parallel/collinear pairs have no single
 * intersection point and are skipped.
 */

import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import { worldPoint } from '@arq/geometry-2d';
import type { SegmentCandidate } from './segment-candidate';
import { DEFAULT_SNAP_TOLERANCE_PX, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';

/** Returns the intersection point of two segments if it falls within both of their bounds, else null. */
export function segmentIntersection(a: SegmentCandidate, b: SegmentCandidate): WorldPoint | null {
  const x1 = a.start.x;
  const y1 = a.start.y;
  const x2 = a.end.x;
  const y2 = a.end.y;
  const x3 = b.start.x;
  const y3 = b.start.y;
  const x4 = b.end.x;
  const y4 = b.end.y;

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (denominator === 0) {
    return null;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }

  return worldPoint(x1 + t * (x2 - x1), y1 + t * (y2 - y1));
}

export function findIntersectionSnaps(
  candidates: readonly SegmentCandidate[],
  cursor: WorldPoint,
  viewport: Viewport,
  toleranceScreenPx: number = DEFAULT_SNAP_TOLERANCE_PX,
): readonly SnapResult[] {
  const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
  const results: SnapResult[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i]!;
      const b = candidates[j]!;
      const point = segmentIntersection(a, b);
      if (!point) {
        continue;
      }
      const distanceWorld = Math.hypot(point.x - cursor.x, point.y - cursor.y);
      if (distanceWorld <= toleranceWorld) {
        results.push({
          source: 'intersection',
          point,
          priority: SNAP_SOURCE_PRIORITY.intersection,
          screenDistance: distanceWorld * viewport.pixelsPerUnit,
        });
      }
    }
  }
  return results;
}

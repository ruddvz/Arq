/**
 * ARQ-048: intersection snap.
 *
 * Snaps to the point where two segment candidates actually cross each
 * other *within their bounds* - not where their infinite extensions would
 * cross (that is extension-snap.ts's concern, ARQ-051). Every unique pair
 * of candidates is tested; parallel/collinear pairs have no single
 * intersection point and are skipped.
 *
 * The intersection math itself now lives in @arq/geometry-2d's
 * segmentIntersection (ARQ-083), which is tolerance-aware; this module
 * delegates with an exact (zero) tolerance to keep its existing
 * two-argument public signature and behaviour unchanged rather than
 * pushing a new tolerance parameter onto every caller as an unrelated
 * change.
 */

import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import { segmentIntersection as coreSegmentIntersection } from '@arq/geometry-2d';
import type { SegmentCandidate } from './segment-candidate';
import { DEFAULT_SNAP_TOLERANCE_PX, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';

/** Returns the intersection point of two segments if it falls within both of their bounds, else null. */
export function segmentIntersection(a: SegmentCandidate, b: SegmentCandidate): WorldPoint | null {
  return coreSegmentIntersection(a, b, 0);
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

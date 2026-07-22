/**
 * ARQ-047: midpoint snap.
 *
 * Snaps to the midpoint of each segment candidate when the cursor is
 * within tolerance of it - same tolerance-conversion pattern as
 * endpoint-snap.ts.
 */

import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import { worldPoint } from '@arq/geometry-2d';
import type { SegmentCandidate } from './segment-candidate';
import { DEFAULT_SNAP_TOLERANCE_PX, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';

export function findMidpointSnaps(
  candidates: readonly SegmentCandidate[],
  cursor: WorldPoint,
  viewport: Viewport,
  toleranceScreenPx: number = DEFAULT_SNAP_TOLERANCE_PX,
): readonly SnapResult[] {
  const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
  const results: SnapResult[] = [];
  for (const candidate of candidates) {
    const midpoint = worldPoint(
      (candidate.start.x + candidate.end.x) / 2,
      (candidate.start.y + candidate.end.y) / 2,
    );
    const distanceWorld = Math.hypot(midpoint.x - cursor.x, midpoint.y - cursor.y);
    if (distanceWorld <= toleranceWorld) {
      results.push({
        source: 'midpoint',
        point: midpoint,
        priority: SNAP_SOURCE_PRIORITY.midpoint,
        screenDistance: distanceWorld * viewport.pixelsPerUnit,
      });
    }
  }
  return results;
}

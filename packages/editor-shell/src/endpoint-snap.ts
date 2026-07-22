/**
 * ARQ-046: endpoint snap.
 *
 * The first concrete snap source built on the ARQ-045 contract: given a
 * set of world-space endpoint candidates (deliberately just {point} - no
 * notion of which wall/element the endpoint belongs to, per the same
 * non-goal as hit-test.ts), returns a SnapResult for every candidate
 * within tolerance of the cursor. Tolerance is specified in screen pixels
 * and converted to world units via the current viewport, exactly like
 * hit-test.ts's pickAt.
 *
 * Multiple candidates can be within tolerance at once (this returns all
 * of them) - picking the single best one across *all* active snap
 * sources (not just endpoint) is pickBestSnap's job, once more sources
 * exist to combine.
 */

import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import { DEFAULT_SNAP_TOLERANCE_PX, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';

export interface EndpointCandidate {
  readonly point: WorldPoint;
}

export function findEndpointSnaps(
  candidates: readonly EndpointCandidate[],
  cursor: WorldPoint,
  viewport: Viewport,
  toleranceScreenPx: number = DEFAULT_SNAP_TOLERANCE_PX,
): readonly SnapResult[] {
  const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
  const results: SnapResult[] = [];
  for (const candidate of candidates) {
    const distanceWorld = Math.hypot(candidate.point.x - cursor.x, candidate.point.y - cursor.y);
    if (distanceWorld <= toleranceWorld) {
      results.push({
        source: 'endpoint',
        point: candidate.point,
        priority: SNAP_SOURCE_PRIORITY.endpoint,
        screenDistance: distanceWorld * viewport.pixelsPerUnit,
      });
    }
  }
  return results;
}

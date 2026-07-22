/**
 * ARQ-051: extension snap.
 *
 * Projects the cursor onto the infinite line through each candidate
 * segment, but only accepts the result when it falls *beyond* one of the
 * segment's endpoints (t < 0 or t > 1) - a point already between the
 * endpoints is what endpoint/midpoint/nearest snap to, not an extension.
 * A zero-length segment has no defined line and is skipped.
 */

import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import { worldPoint } from '@arq/geometry-2d';
import type { SegmentCandidate } from './segment-candidate';
import { DEFAULT_SNAP_TOLERANCE_PX, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';

/** Returns the point on segment's extended line nearest to `cursor`, or null if it lies within the segment's own bounds (or the segment has zero length). */
export function extensionPoint(segment: SegmentCandidate, cursor: WorldPoint): WorldPoint | null {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return null;
  }
  const t = ((cursor.x - segment.start.x) * dx + (cursor.y - segment.start.y) * dy) / lengthSquared;
  if (t >= 0 && t <= 1) {
    return null;
  }
  return worldPoint(segment.start.x + t * dx, segment.start.y + t * dy);
}

export function findExtensionSnaps(
  candidates: readonly SegmentCandidate[],
  cursor: WorldPoint,
  viewport: Viewport,
  toleranceScreenPx: number = DEFAULT_SNAP_TOLERANCE_PX,
): readonly SnapResult[] {
  const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
  const results: SnapResult[] = [];
  for (const candidate of candidates) {
    const point = extensionPoint(candidate, cursor);
    if (!point) {
      continue;
    }
    const distanceWorld = Math.hypot(point.x - cursor.x, point.y - cursor.y);
    if (distanceWorld <= toleranceWorld) {
      results.push({
        source: 'extension',
        point,
        priority: SNAP_SOURCE_PRIORITY.extension,
        screenDistance: distanceWorld * viewport.pixelsPerUnit,
      });
    }
  }
  return results;
}

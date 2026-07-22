/**
 * ARQ-191 (partial): nearest snap.
 *
 * The plain closest point on a segment to the cursor, valid anywhere
 * along the segment (including its interior) - unlike perpendicular snap
 * (ARQ-049, which requires a specific reference point and is only valid
 * when the foot lands on the segment) and extension snap (ARQ-051, only
 * valid *beyond* the segment). This is the true fallback the spec's
 * ordering implies: Nearest is listed last (lowest priority) precisely
 * because it always has an answer when nothing more specific matches.
 *
 * Centre snap (the other half of ARQ-191) is not implemented here: it
 * needs a closed-shape candidate type (circle/arc) that doesn't exist in
 * this codebase yet - see ARQ-191's non-goals.
 */

import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import { worldPoint } from '@arq/geometry-2d';
import type { SegmentCandidate } from './segment-candidate';
import { DEFAULT_SNAP_TOLERANCE_PX, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';

/** Returns the closest point on `segment` to `point`, clamped to the segment's own bounds. */
export function closestPointOnSegment(segment: SegmentCandidate, point: WorldPoint): WorldPoint {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return segment.start;
  }
  const t = Math.min(
    1,
    Math.max(
      0,
      ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared,
    ),
  );
  return worldPoint(segment.start.x + t * dx, segment.start.y + t * dy);
}

export function findNearestSnaps(
  candidates: readonly SegmentCandidate[],
  cursor: WorldPoint,
  viewport: Viewport,
  toleranceScreenPx: number = DEFAULT_SNAP_TOLERANCE_PX,
): readonly SnapResult[] {
  const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
  const results: SnapResult[] = [];
  for (const candidate of candidates) {
    const point = closestPointOnSegment(candidate, cursor);
    const distanceWorld = Math.hypot(point.x - cursor.x, point.y - cursor.y);
    if (distanceWorld <= toleranceWorld) {
      results.push({
        source: 'nearest',
        point,
        priority: SNAP_SOURCE_PRIORITY.nearest,
        screenDistance: distanceWorld * viewport.pixelsPerUnit,
      });
    }
  }
  return results;
}

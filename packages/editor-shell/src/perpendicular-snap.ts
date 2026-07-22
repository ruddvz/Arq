/**
 * ARQ-049: perpendicular snap.
 *
 * Given a reference point `from` (typically the start of the segment the
 * user is currently drawing), finds the foot of the perpendicular from
 * `from` onto each candidate segment - the point that would make the new
 * segment perpendicular to that candidate. Only valid when the foot
 * actually lies on the segment (not its extension - that's a different
 * concern, see extension-snap.ts); a zero-length segment has no defined
 * perpendicular and is skipped.
 */

import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import { worldPoint } from '@arq/geometry-2d';
import type { SegmentCandidate } from './segment-candidate';
import { DEFAULT_SNAP_TOLERANCE_PX, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';

/** Returns the foot of the perpendicular from `from` onto `segment`, or null if it falls outside the segment or the segment has zero length. */
export function perpendicularFoot(segment: SegmentCandidate, from: WorldPoint): WorldPoint | null {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return null;
  }
  const t = ((from.x - segment.start.x) * dx + (from.y - segment.start.y) * dy) / lengthSquared;
  if (t < 0 || t > 1) {
    return null;
  }
  return worldPoint(segment.start.x + t * dx, segment.start.y + t * dy);
}

export function findPerpendicularSnaps(
  candidates: readonly SegmentCandidate[],
  from: WorldPoint,
  cursor: WorldPoint,
  viewport: Viewport,
  toleranceScreenPx: number = DEFAULT_SNAP_TOLERANCE_PX,
): readonly SnapResult[] {
  const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
  const results: SnapResult[] = [];
  for (const candidate of candidates) {
    const foot = perpendicularFoot(candidate, from);
    if (!foot) {
      continue;
    }
    const distanceWorld = Math.hypot(foot.x - cursor.x, foot.y - cursor.y);
    if (distanceWorld <= toleranceWorld) {
      results.push({
        source: 'perpendicular',
        point: foot,
        priority: SNAP_SOURCE_PRIORITY.perpendicular,
        screenDistance: distanceWorld * viewport.pixelsPerUnit,
      });
    }
  }
  return results;
}

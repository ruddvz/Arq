/**
 * ARQ-191: centre snap.
 *
 * Centre snap is intentionally limited to explicit circular geometry in Phase 1:
 * circles and arcs snap to the centre of their parent circle. Rectangular
 * bounding-box centres are not inferred because that would make "centre" depend
 * on selection bounds rather than authored geometry.
 */
import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import type { CircularCandidate } from './circular-candidate';
import { isValidCircularCandidate } from './circular-candidate';
import { DEFAULT_SNAP_TOLERANCE_PX, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';

export function findCentreSnaps(
  candidates: readonly CircularCandidate[],
  cursor: WorldPoint,
  viewport: Viewport,
  toleranceScreenPx: number = DEFAULT_SNAP_TOLERANCE_PX,
): readonly SnapResult[] {
  if (
    !Number.isFinite(viewport.pixelsPerUnit) ||
    viewport.pixelsPerUnit <= 0 ||
    !Number.isFinite(toleranceScreenPx) ||
    toleranceScreenPx < 0
  ) {
    return [];
  }

  const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
  const results: SnapResult[] = [];

  for (const candidate of candidates) {
    if (!isValidCircularCandidate(candidate)) {
      continue;
    }

    const distanceWorld = Math.hypot(candidate.centre.x - cursor.x, candidate.centre.y - cursor.y);

    if (distanceWorld <= toleranceWorld) {
      results.push({
        source: 'centre',
        point: candidate.centre,
        priority: SNAP_SOURCE_PRIORITY.centre,
        screenDistance: distanceWorld * viewport.pixelsPerUnit,
      });
    }
  }

  return results;
}

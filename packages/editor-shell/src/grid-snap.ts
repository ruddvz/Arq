/**
 * ARQ-050: grid snap.
 *
 * Snaps the cursor to the nearest point on a square world-space grid of
 * the given spacing. Gated by the same screen-pixel tolerance convention
 * as every other snap source (so it fits pickBestSnap's priority/distance
 * ordering uniformly), even though a grid technically has a nearest point
 * everywhere - without a tolerance gate, grid snap would always win over
 * every lower-priority source regardless of how far away it actually is.
 */

import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import { worldPoint } from '@arq/geometry-2d';
import { DEFAULT_SNAP_TOLERANCE_PX, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';

export function findGridSnap(
  cursor: WorldPoint,
  gridSpacing: number,
  viewport: Viewport,
  toleranceScreenPx: number = DEFAULT_SNAP_TOLERANCE_PX,
): SnapResult | undefined {
  if (!Number.isFinite(gridSpacing) || gridSpacing <= 0) {
    throw new RangeError('gridSpacing must be a positive finite number');
  }
  const nearest = worldPoint(
    Math.round(cursor.x / gridSpacing) * gridSpacing,
    Math.round(cursor.y / gridSpacing) * gridSpacing,
  );
  const distanceWorld = Math.hypot(nearest.x - cursor.x, nearest.y - cursor.y);
  const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
  if (distanceWorld > toleranceWorld) {
    return undefined;
  }
  return {
    source: 'grid',
    point: nearest,
    priority: SNAP_SOURCE_PRIORITY.grid,
    screenDistance: distanceWorld * viewport.pixelsPerUnit,
  };
}

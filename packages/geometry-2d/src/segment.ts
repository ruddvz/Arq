/**
 * A straight line segment between two world points - shared by
 * segment-intersection.ts (ARQ-083) and nearest-point.ts (ARQ-084) so
 * both operate on the same shape instead of each declaring their own.
 */

import type { WorldPoint } from './coordinate-system';

export interface Segment {
  readonly start: WorldPoint;
  readonly end: WorldPoint;
}

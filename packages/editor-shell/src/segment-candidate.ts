/**
 * Shared candidate shape for the segment-based snap sources (midpoint,
 * intersection, perpendicular, extension - ARQ-047/048/049/051):
 * deliberately just the two endpoints, no notion of which wall or element
 * the segment belongs to, per the same non-goal as hit-test.ts and
 * endpoint-snap.ts.
 */

import type { WorldPoint } from '@arq/geometry-2d';

export interface SegmentCandidate {
  readonly start: WorldPoint;
  readonly end: WorldPoint;
}

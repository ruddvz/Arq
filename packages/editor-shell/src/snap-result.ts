/**
 * ARQ-045: snap result contract.
 *
 * docs/ux/SELECTION-AND-SNAPPING.md lists eight snap sources (Endpoint,
 * Intersection, Midpoint, Perpendicular, Centre, Grid, Extension, Nearest)
 * and says "Snap results are calculated outside the renderer and include
 * source, priority, screen distance and suggested constraint." This module
 * defines that shared result shape; individual snap types (ARQ-046
 * onwards) each produce SnapResult values against it, and a renderer or
 * tool picks among them with pickBestSnap - none of this touches a
 * renderer or project-element vocabulary itself, per this issue's
 * non-goal.
 *
 * Escape/Enter: Escape clears any pending snap suggestion, reverting to
 * the raw cursor position (handled by the caller, not this module -
 * there is no mutable state here to clear). Enter commits using whatever
 * snap point is currently suggested, if any, otherwise the raw cursor
 * position - the same "commits only a valid preview" contract as the
 * command lifecycle (ARQ-038).
 */

import type { WorldPoint } from '@arq/geometry-2d';

export type SnapSource =
  | 'endpoint'
  | 'intersection'
  | 'midpoint'
  | 'perpendicular'
  | 'centre'
  | 'grid'
  | 'extension'
  | 'nearest';

export type SnapConstraint =
  | { readonly type: 'horizontal' }
  | { readonly type: 'vertical' }
  | { readonly type: 'along-angle'; readonly angleRadians: number };

export interface SnapResult {
  readonly source: SnapSource;
  readonly point: WorldPoint;
  readonly priority: number;
  readonly screenDistance: number;
  readonly suggestedConstraint?: SnapConstraint;
}

/** Shared default hit-tolerance (screen pixels) for every snap source, unless a caller overrides it. */
export const DEFAULT_SNAP_TOLERANCE_PX = 10;

/**
 * Canonical priority ranking (lower number wins ties). This is the order
 * SELECTION-AND-SNAPPING.md lists the eight sources in - read literally as
 * a priority order since it is the only ordering signal the spec gives.
 * If that reading turns out wrong once more snap types exist, this table
 * is the single place to correct it; nothing else hardcodes an ordering.
 */
export const SNAP_SOURCE_PRIORITY: Readonly<Record<SnapSource, number>> = {
  endpoint: 0,
  intersection: 1,
  midpoint: 2,
  perpendicular: 3,
  centre: 4,
  grid: 5,
  extension: 6,
  nearest: 7,
};

/** Picks the highest-priority result (lowest priority number), breaking ties by screen distance. */
export function pickBestSnap(results: readonly SnapResult[]): SnapResult | undefined {
  if (results.length === 0) {
    return undefined;
  }
  return [...results].sort(
    (a, b) => a.priority - b.priority || a.screenDistance - b.screenDistance,
  )[0];
}

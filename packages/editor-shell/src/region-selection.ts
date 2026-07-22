/**
 * ARQ-041: window selection. ARQ-042: crossing selection.
 *
 * A generic region-test contract mirroring hit-test.ts's HitTestable, for
 * "drag a rectangle" selection: window selection keeps only candidates
 * entirely inside the rectangle, crossing selection keeps anything the
 * rectangle touches at all. As with hit-test.ts, this has no notion of
 * walls/doors/any project element and no renderer dependency.
 *
 * For a point candidate (the only candidate shape implemented so far -
 * see point-selection.ts) window and crossing selection are necessarily
 * the same test: a zero-area point is either inside the rectangle or it
 * isn't, there is no partial overlap. The two modes only diverge once a
 * candidate has real extent (e.g. a line that crosses an edge of the
 * rectangle without either endpoint being inside it) - that depends on a
 * line/wall candidate shape which does not exist yet (no document/scene
 * model - see the same gap noted when ARQ-034 closed). Which direction a
 * drag went (left-to-right = window, right-to-left = crossing, the usual
 * CAD convention) is an interaction-layer decision made by the caller, not
 * this module - this module only answers "given a mode, which candidates
 * match".
 *
 * Escape/Enter: Escape cancels an in-progress drag before it commits a
 * selection (the caller drops the in-progress rectangle and calls
 * nothing here). Enter has no defined behaviour, for the same reason as
 * point selection - there is no preview/commit step to confirm.
 */

import { worldPoint, type WorldPoint } from '@arq/geometry-2d';

export interface WorldBounds {
  readonly min: WorldPoint;
  readonly max: WorldPoint;
}

/** Builds a normalized (min <= max on both axes) bounds from two drag corners in either order. */
export function boundsFromCorners(a: WorldPoint, b: WorldPoint): WorldBounds {
  return {
    min: worldPoint(Math.min(a.x, b.x), Math.min(a.y, b.y)),
    max: worldPoint(Math.max(a.x, b.x), Math.max(a.y, b.y)),
  };
}

export interface RegionTestable {
  isContainedBy(region: WorldBounds): boolean;
  intersectsRegion(region: WorldBounds): boolean;
}

export interface RegionCandidate<TId> extends RegionTestable {
  readonly id: TId;
}

export type RegionSelectionMode = 'window' | 'crossing';

export function selectInRegion<TId>(
  candidates: readonly RegionCandidate<TId>[],
  region: WorldBounds,
  mode: RegionSelectionMode,
): readonly TId[] {
  const matches =
    mode === 'window'
      ? (c: RegionCandidate<TId>) => c.isContainedBy(region)
      : (c: RegionCandidate<TId>) => c.intersectsRegion(region);
  return candidates.filter(matches).map((c) => c.id);
}

export function createPointRegionTestable(target: WorldPoint): RegionTestable {
  const inRegion = (region: WorldBounds): boolean =>
    target.x >= region.min.x &&
    target.x <= region.max.x &&
    target.y >= region.min.y &&
    target.y <= region.max.y;
  return {
    isContainedBy: inRegion,
    intersectsRegion: inRegion,
  };
}

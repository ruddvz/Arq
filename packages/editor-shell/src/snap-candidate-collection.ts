/**
 * V3-090: the generation half of "deterministic inference candidate generation
 * and ranking".
 *
 * `inference-engine.ts` ranks a `SnapResult[]` and its own doc comment names the
 * gap it left: "The eight snap modules in this package each answer 'is there an
 * endpoint / intersection / midpoint near the cursor'. None of them answers the
 * question the drawing tools actually ask." Ranking was written; nothing built
 * the list to rank. Eight snap sources and a ranking layer had no path between
 * them, so the whole subsystem had no entry point and every module in it was
 * reachable only from its own tests.
 *
 * This is that path, and it is deliberately thin: it runs the sources, and it
 * does not decide anything the sources or the ranker already decide.
 *
 * **Every source is optional, and an absent input is not an empty one.** A tool
 * drawing the first point of a wall has no `from` point, so perpendicular
 * cannot be computed at all - which is different from computing it and finding
 * nothing. Passing `undefined` skips the source; passing an empty array runs it
 * against no geometry. Collapsing the two would make "this source is off" and
 * "this source found nothing" indistinguishable to a surface that wants to
 * explain why a snap did not appear.
 *
 * **Grid is the one source that always produces a candidate.** It answers from
 * the cursor and a spacing rather than from scene geometry, and it returns at
 * most one result rather than a list. It is folded in here so callers do not
 * each remember that asymmetry.
 *
 * Ordering is by source priority, not by call order, so the array handed to
 * `rankCandidates` is already deterministic before the sort runs. A stable sort
 * over an unstable input is still unstable, and this is the input.
 */
import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import type { CircularCandidate } from './circular-candidate';
import type { EndpointCandidate } from './endpoint-snap';
import type { SegmentCandidate } from './segment-candidate';
import { DEFAULT_SNAP_TOLERANCE_PX, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';
import { findEndpointSnaps } from './endpoint-snap';
import { findIntersectionSnaps } from './intersection-snap';
import { findMidpointSnaps } from './midpoint-snap';
import { findPerpendicularSnaps } from './perpendicular-snap';
import { findCentreSnaps } from './centre-snap';
import { findGridSnap } from './grid-snap';
import { findExtensionSnaps } from './extension-snap';
import { findNearestSnaps } from './nearest-snap';

export interface SnapScene {
  /** Endpoints to snap to. Absent means the endpoint source is off for this call. */
  readonly endpoints?: readonly EndpointCandidate[];
  /** Segments feeding intersection, midpoint, perpendicular, extension and nearest. */
  readonly segments?: readonly SegmentCandidate[];
  /** Circles and arcs feeding the centre source. */
  readonly circulars?: readonly CircularCandidate[];
  /**
   * World-unit grid spacing. Absent means no grid snapping; a non-positive or
   * non-finite value is a caller mistake and `findGridSnap` throws on it, which
   * is left to throw rather than swallowed here.
   */
  readonly gridSpacing?: number;
  /**
   * The point a perpendicular is measured from - the wall's start while its end
   * is being dragged. Absent means perpendicular cannot be computed, which is
   * the ordinary state before a first point exists.
   */
  readonly from?: WorldPoint;
}

/**
 * Runs every applicable snap source against the scene and returns their results
 * in canonical source-priority order.
 *
 * Returns raw `SnapResult`s rather than ranked candidates: suppression and
 * cycling belong to `resolveInference`, which owns the caller's interaction
 * state. Splitting them keeps this function pure in the scene and lets a caller
 * collect once and re-rank under different suppression without re-running the
 * geometry.
 */
export function collectSnapCandidates(
  scene: SnapScene,
  cursor: WorldPoint,
  viewport: Viewport,
  toleranceScreenPx: number = DEFAULT_SNAP_TOLERANCE_PX,
): readonly SnapResult[] {
  const results: SnapResult[] = [];

  if (scene.endpoints !== undefined) {
    results.push(...findEndpointSnaps(scene.endpoints, cursor, viewport, toleranceScreenPx));
  }
  if (scene.segments !== undefined) {
    results.push(...findIntersectionSnaps(scene.segments, cursor, viewport, toleranceScreenPx));
    results.push(...findMidpointSnaps(scene.segments, cursor, viewport, toleranceScreenPx));
    if (scene.from !== undefined) {
      results.push(
        ...findPerpendicularSnaps(scene.segments, scene.from, cursor, viewport, toleranceScreenPx),
      );
    }
    results.push(...findExtensionSnaps(scene.segments, cursor, viewport, toleranceScreenPx));
    results.push(...findNearestSnaps(scene.segments, cursor, viewport, toleranceScreenPx));
  }
  if (scene.circulars !== undefined) {
    results.push(...findCentreSnaps(scene.circulars, cursor, viewport, toleranceScreenPx));
  }
  if (scene.gridSpacing !== undefined) {
    const grid = findGridSnap(cursor, scene.gridSpacing, viewport, toleranceScreenPx);
    if (grid !== undefined) {
      results.push(grid);
    }
  }

  // Priority order first, then screen distance. The ranker sorts again and would
  // reach the same answer, but it can only be as deterministic as what it is
  // given: two candidates equal on every key it compares keep the order they
  // arrived in, and that order should not depend on which `if` ran first.
  return results.sort(
    (a, b) =>
      SNAP_SOURCE_PRIORITY[a.source] - SNAP_SOURCE_PRIORITY[b.source] ||
      a.screenDistance - b.screenDistance,
  );
}

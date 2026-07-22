/**
 * ARQ-039: selection hit-test interface.
 *
 * A generic, geometry-only contract for "is this world point on this
 * candidate" - deliberately with no notion of walls, doors, or any other
 * project/BIM element, and no dependency on a renderer (per this issue's
 * non-goal: don't couple project semantics to renderer or external-format
 * classes). Concrete candidate shapes (points, later: lines, regions) each
 * implement HitTestable and are looked up through pickAt, which is the one
 * place that knows about screen-pixel tolerance and the current zoom level.
 */

import type { Viewport, WorldPoint } from '@arq/geometry-2d';

export interface HitTestable {
  /**
   * `toleranceWorld` is already converted from screen pixels to world
   * units for the caller's current zoom level - implementations work
   * purely in world space and never see pixels.
   */
  hitTest(point: WorldPoint, toleranceWorld: number): boolean;
}

export interface HitCandidate<TId> extends HitTestable {
  readonly id: TId;
}

export const DEFAULT_HIT_TEST_TOLERANCE_PX = 6;

/**
 * Finds the first candidate (in the order given) whose hitTest succeeds.
 * Order is significant and is the caller's responsibility: pass candidates
 * in desired pick-priority order (e.g. topmost-drawn first) since this
 * function does not re-sort by distance or z-order on its own.
 */
export function pickAt<TId>(
  candidates: readonly HitCandidate<TId>[],
  point: WorldPoint,
  viewport: Viewport,
  toleranceScreenPx: number = DEFAULT_HIT_TEST_TOLERANCE_PX,
): HitCandidate<TId> | undefined {
  const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
  return candidates.find((candidate) => candidate.hitTest(point, toleranceWorld));
}

/**
 * Like pickAt, but returns every matching candidate's id in priority
 * order rather than just the first - the input candidate-cycling.ts
 * needs to know the full stack under the pointer, not just the winner.
 */
export function pickAllAt<TId>(
  candidates: readonly HitCandidate<TId>[],
  point: WorldPoint,
  viewport: Viewport,
  toleranceScreenPx: number = DEFAULT_HIT_TEST_TOLERANCE_PX,
): readonly TId[] {
  const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
  return candidates
    .filter((candidate) => candidate.hitTest(point, toleranceWorld))
    .map((candidate) => candidate.id);
}

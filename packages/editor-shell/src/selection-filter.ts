/**
 * ARQ-044: selection filters.
 *
 * Restricts which candidates are even eligible for hit-testing - not just
 * which of the hits get kept afterwards. This matters because
 * docs/ux/SELECTION-AND-SNAPPING.md says "Hidden objects do not receive
 * canvas hits": a filtered-out candidate must be removed *before*
 * pickAt/pickAllAt run, so it can never win priority over an eligible
 * candidate underneath it, not merely be discarded from the result.
 *
 * Filters are generic predicates over whatever candidate shape the caller
 * has (category, visibility, layer, or any combination) - this module has
 * no built-in vocabulary of project element types (wall, door, ...), per
 * this issue's non-goal against coupling to project semantics.
 */

import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import { pickAt, type HitCandidate } from './hit-test';

export type SelectionFilter<TCandidate> = (candidate: TCandidate) => boolean;

/** AND-combines any number of filters: a candidate must pass every one to be eligible. */
export function combineFilters<TCandidate>(
  ...filters: readonly SelectionFilter<TCandidate>[]
): SelectionFilter<TCandidate> {
  return (candidate) => filters.every((filter) => filter(candidate));
}

/** Builds a filter admitting only candidates whose `category` is in `allowed`. */
export function categoryFilter<TCandidate extends { readonly category: string }>(
  allowed: ReadonlySet<TCandidate['category']> | readonly TCandidate['category'][],
): SelectionFilter<TCandidate> {
  const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);
  return (candidate) => allowedSet.has(candidate.category);
}

/** Builds a filter admitting only candidates whose `visible` flag is true. */
export function visibilityFilter<
  TCandidate extends { readonly visible: boolean },
>(): SelectionFilter<TCandidate> {
  return (candidate) => candidate.visible;
}

/**
 * pickAt, but candidates failing `filter` are removed before hit-testing
 * runs at all - a filtered-out candidate cannot block or outrank an
 * eligible one underneath it.
 */
export function pickAtWithFilter<TId, TCandidate extends HitCandidate<TId>>(
  candidates: readonly TCandidate[],
  point: WorldPoint,
  viewport: Viewport,
  filter: SelectionFilter<TCandidate>,
  toleranceScreenPx?: number,
): HitCandidate<TId> | undefined {
  return pickAt(candidates.filter(filter), point, viewport, toleranceScreenPx);
}

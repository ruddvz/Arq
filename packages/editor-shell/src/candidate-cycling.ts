/**
 * ARQ-043: candidate cycling.
 *
 * Implements docs/ux/SELECTION-AND-SNAPPING.md's "Tab cycles candidates":
 * when a click hits several overlapping candidates (pickAllAt from
 * hit-test.ts), the top-priority one is selected first; pressing Tab
 * again while the click point hasn't changed cycles to the next one
 * underneath, wrapping around after the last.
 *
 * A fresh click (a new call to begin()) always resets the cycle back to
 * the top candidate - cycling only applies to repeated Tab presses
 * against the same click, not across different clicks.
 *
 * Escape/Enter: Escape stops cycling and clears the candidate stack
 * (equivalent to point-selection's escape - the caller is expected to
 * also clear the actual selection). Enter has no defined behaviour, same
 * as point/region selection - there is no preview/commit step here.
 */

export function createCandidateCycler<TId>() {
  let candidateIds: readonly TId[] = [];
  let index = 0;

  /** Starts (or restarts) cycling over a fresh set of candidate ids, returning the first one (or null if empty). */
  function begin(ids: readonly TId[]): TId | null {
    candidateIds = ids;
    index = 0;
    return candidateIds[0] ?? null;
  }

  /** Advances to the next candidate underneath, wrapping around; null if there is nothing to cycle. */
  function cycleNext(): TId | null {
    if (candidateIds.length === 0) {
      return null;
    }
    index = (index + 1) % candidateIds.length;
    return candidateIds[index] ?? null;
  }

  function current(): TId | null {
    return candidateIds[index] ?? null;
  }

  function reset(): void {
    candidateIds = [];
    index = 0;
  }

  return { begin, cycleNext, current, reset };
}

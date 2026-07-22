/**
 * ARQ-052: snap tie-break.
 *
 * The actual tie-break rule (priority first, screen distance as the
 * tiebreaker) already lives in snap-result.ts's pickBestSnap (ARQ-045),
 * since a tie-break rule and the result contract it operates on are the
 * same concern. What was still missing is the ergonomic, explicitly
 * named way to combine several snap sources' results before picking
 * among them - combineSnapSources(...) - plus test coverage for the
 * final tiebreaker pickBestSnap relies on but nothing exercised yet:
 * when priority AND screen distance are both equal, Array.sort's
 * stability means the earlier-listed result wins, which is
 * deterministic (not "whichever the engine happens to pick") and is
 * exactly what a caller needs to reason about combining sources in a
 * fixed, intentional order (e.g. endpoint results listed before grid
 * results, so an exact tie between them resolves to endpoint - already
 * true by priority anyway, but the stability guarantee is what makes
 * same-priority same-distance ties from *different instances of the
 * same source* resolve predictably too).
 */

import type { SnapResult } from './snap-result';

/** Flattens any number of per-source SnapResult arrays into one, ready for pickBestSnap. */
export function combineSnapSources(
  ...resultArrays: readonly (readonly SnapResult[])[]
): readonly SnapResult[] {
  return resultArrays.flat();
}

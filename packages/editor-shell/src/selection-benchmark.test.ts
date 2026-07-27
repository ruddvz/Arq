/**
 * ARQ-149: add selection benchmark.
 *
 * Blueprint section 120's protected benchmark model (150 walls, 80
 * openings, 60 rooms, 200 annotations, "approximately 1,000 semantic
 * objects") and its "selection median under 50 ms" target, measured
 * against the real `pickAt` (hit-test.ts, ARQ-039) - the actual
 * production hit-testing function, not a reimplementation.
 *
 * Unlike ARQ-115/116/117's renderer benchmarks, this needs no browser:
 * hit-testing is pure computation (no Canvas/WebGL/DOM involved), so it
 * runs as a normal Vitest test in this real environment and measures
 * real wall-clock time via `performance.now()` - the same "real
 * measurement, not an estimate" standard those benchmarks set, just
 * without Playwright's overhead since nothing here needs a browser.
 *
 * 150 candidates are real segment-based HitTestables (walls, using
 * @arq/geometry-2d's closestPointOnSegment - the same distance
 * calculation nearest-snap.ts already uses in production); the
 * remaining 850 are point-based (createPointHitTestable, ARQ-040) to
 * reach section 120's "approximately 1,000 semantic objects" total.
 * pickAt's own performance characteristic (a linear scan calling each
 * candidate's O(1) hitTest) does not meaningfully differ by candidate
 * shape, so this mix is a faithful, honest stand-in for "clicking
 * among ~1,000 objects" without needing full wall/room geometry this
 * package has no BIM-domain access to (its own long-standing non-goal).
 *
 * Median (not average) is the recorded statistic, matching section
 * 120's own wording "selection median under 50 ms" exactly - a
 * benchmark reporting an average would silently change what is being
 * measured.
 */

import { describe, expect, it } from 'vitest';
import { closestPointOnSegment } from '@arq/geometry-2d';
import { worldPoint, type Viewport, type WorldPoint } from '@arq/geometry-2d';
import { pickAt, type HitCandidate } from './hit-test';
import { createPointHitTestable } from './point-selection';

const WALL_COUNT = 150;
const OTHER_CANDIDATE_COUNT = 850; // openings + rooms + annotations + padding, to reach "approximately 1,000" total.
const TRIAL_COUNT = 500;
const SELECTION_MEDIAN_TARGET_MS = 50; // benchmarks/PERFORMANCE-BUDGETS.json's selectionMedianMs.

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (sorted.length % 2 === 0 && lower !== undefined && upper !== undefined) {
    return (lower + upper) / 2;
  }
  return sorted[mid] ?? 0;
}

function buildBenchmarkCandidates(): readonly HitCandidate<string>[] {
  const candidates: HitCandidate<string>[] = [];

  for (let i = 0; i < WALL_COUNT; i += 1) {
    const start = worldPoint(i * 4000, 0);
    const end = worldPoint(i * 4000 + 3800, 0);
    candidates.push({
      id: `wall-${i}`,
      hitTest(point: WorldPoint, toleranceWorld: number): boolean {
        const nearest = closestPointOnSegment({ start, end }, point);
        const dx = point.x - nearest.x;
        const dy = point.y - nearest.y;
        return dx * dx + dy * dy <= toleranceWorld * toleranceWorld;
      },
    });
  }

  for (let i = 0; i < OTHER_CANDIDATE_COUNT; i += 1) {
    const target = worldPoint((i % 50) * 1000, Math.floor(i / 50) * 1000 + 4000);
    candidates.push({ id: `other-${i}`, ...createPointHitTestable(target) });
  }

  return candidates;
}

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 2,
  screenWidth: 1600,
  screenHeight: 1000,
};

describe('selection benchmark (ARQ-149)', () => {
  it('produces the expected total candidate count matching "approximately 1,000 semantic objects"', () => {
    expect(buildBenchmarkCandidates()).toHaveLength(WALL_COUNT + OTHER_CANDIDATE_COUNT);
  });

  it('meets the selection median under 50ms target (section 120) against ~1,000 candidates, including a worst-case miss', () => {
    const candidates = buildBenchmarkCandidates();
    const durationsMs: number[] = [];

    for (let trial = 0; trial < TRIAL_COUNT; trial += 1) {
      // A point guaranteed to hit nothing - pickAt must scan every
      // candidate before giving up, the worst case for a linear scan.
      const missPoint = worldPoint(-999999, -999999);
      const start = performance.now();
      pickAt(candidates, missPoint, viewport);
      durationsMs.push(performance.now() - start);
    }

    const medianMs = median(durationsMs);

    console.log(
      `selection benchmark: median ${medianMs.toFixed(4)}ms over ${TRIAL_COUNT} trials (~1,000 candidates, worst-case miss)`,
    );
    expect(medianMs).toBeLessThan(SELECTION_MEDIAN_TARGET_MS);
  });

  it('still finds the correct candidate among ~1,000 others (correctness, not just speed)', () => {
    const candidates = buildBenchmarkCandidates();
    const target = candidates[candidates.length - 1];
    if (target === undefined || target.hitTest === undefined) {
      throw new Error('test setup error: no target candidate');
    }
    // The last "other" candidate's own target point, from buildBenchmarkCandidates.
    const lastIndex = OTHER_CANDIDATE_COUNT - 1;
    const point = worldPoint((lastIndex % 50) * 1000, Math.floor(lastIndex / 50) * 1000 + 4000);
    const found = pickAt(candidates, point, viewport);
    expect(found?.id).toBe(`other-${lastIndex}`);
  });
});

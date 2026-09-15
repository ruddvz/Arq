/**
 * ARQ-149 selection compute microbenchmark.
 *
 * This remains a compute-only measurement of real `pickAt` hit-testing across
 * approximately 1,000 synthetic candidates. #402 now owns the target. This
 * test must not create a second threshold or claim end-to-end interaction
 * latency from a pure-function benchmark.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { closestPointOnSegment } from '@arq/geometry-2d';
import { worldPoint, type Viewport, type WorldPoint } from '@arq/geometry-2d';
import { pickAt, type HitCandidate } from './hit-test';
import { createPointHitTestable } from './point-selection';

const WALL_COUNT = 150;
const OTHER_CANDIDATE_COUNT = 850;
const TRIAL_COUNT = 500;

function canonicalSelectionTargetMs(): number {
  const authority = JSON.parse(
    readFileSync(new URL('../../../benchmarks/PERFORMANCE-BUDGETS.json', import.meta.url), 'utf8'),
  ) as {
    workflows: Array<{
      id: string;
      budget?: { metric?: string; value?: number } | null;
    }>;
  };
  const workflow = authority.workflows.find((entry) => entry.id === 'plan.hover-selection');
  const budget = workflow?.budget;
  if (budget?.metric !== 'selectionComputeMedianMs' || typeof budget.value !== 'number') {
    throw new Error('canonical #402 selection compute target is absent');
  }
  return budget.value;
}

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
  it('produces the expected total candidate count matching the protected approximate 1,000-object scale', () => {
    expect(buildBenchmarkCandidates()).toHaveLength(WALL_COUNT + OTHER_CANDIDATE_COUNT);
  });

  it('meets the canonical #402 selection compute target against ~1,000 candidates, including a worst-case miss', () => {
    const candidates = buildBenchmarkCandidates();
    const durationsMs: number[] = [];

    for (let trial = 0; trial < TRIAL_COUNT; trial += 1) {
      const missPoint = worldPoint(-999999, -999999);
      const start = performance.now();
      pickAt(candidates, missPoint, viewport);
      durationsMs.push(performance.now() - start);
    }

    const medianMs = median(durationsMs);
    const targetMs = canonicalSelectionTargetMs();

    console.log(
      `selection compute benchmark: median ${medianMs.toFixed(4)}ms over ${TRIAL_COUNT} trials (~1,000 candidates, worst-case miss); #402 target ${targetMs}ms`,
    );
    expect(medianMs).toBeLessThan(targetMs);
  });

  it('still finds the correct candidate among ~1,000 others', () => {
    const candidates = buildBenchmarkCandidates();
    const target = candidates[candidates.length - 1];
    if (target === undefined || target.hitTest === undefined) {
      throw new Error('test setup error: no target candidate');
    }
    const lastIndex = OTHER_CANDIDATE_COUNT - 1;
    const point = worldPoint((lastIndex % 50) * 1000, Math.floor(lastIndex / 50) * 1000 + 4000);
    const found = pickAt(candidates, point, viewport);
    expect(found?.id).toBe(`other-${lastIndex}`);
  });
});

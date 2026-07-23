/**
 * ARQ-148: define benchmark hardware.
 *
 * ARQ-115/116/117 already measured the protected benchmark
 * (`benchmarks/PERFORMANCE-BUDGETS.json`'s `benchmarkModel`) in this
 * repository's one real, currently-available environment: a headless
 * Chromium instance (Playwright) running in this sandboxed CI
 * container, software-rendered, no GPU. That environment is what this
 * issue names as `benchmarkDevice` in `PERFORMANCE-BUDGETS.json` -
 * honestly, as the CI reference environment actually used so far, not
 * as a fabricated consumer device this repository has no access to.
 * It is explicitly *not* one of section 121's supported-device-matrix
 * tiers; every renderer benchmark doc already carries that same
 * caveat (see docs/research/RENDERER-BENCHMARK-CANVAS-2D.md's
 * "Important caveat" section) and this does not change that.
 *
 * `PERFORMANCE-BUDGETS.json`'s new `ciBaseline` records the lowest
 * (most conservative) of ARQ-115's three real, measured Canvas 2D
 * runs - 59.35 fps, not the average - so a CI regression check does
 * not fire on ordinary run-to-run variance already observed as normal.
 *
 * `isFpsRegression` turns "regression threshold" (this issue's own
 * acceptance criterion) into one small, reusable, pure check: a
 * measured average fps counts as a regression only when it falls more
 * than `thresholdPercent` below the recorded baseline - future
 * benchmarks (ARQ-149's selection benchmark, ARQ-150's room-rebuild
 * benchmark, ...) can reuse this same check rather than each
 * reimplementing their own regression arithmetic.
 */

export interface BenchmarkBaseline {
  readonly avgFps: number;
}

/** True when `measuredAvgFps` has dropped more than `thresholdPercent` below `baseline.avgFps` - the one thing "regression" means for a frame-rate benchmark. */
export function isFpsRegression(
  measuredAvgFps: number,
  baseline: BenchmarkBaseline,
  thresholdPercent: number,
): boolean {
  if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0) {
    throw new RangeError('thresholdPercent must be a non-negative finite number');
  }
  const floor = baseline.avgFps * (1 - thresholdPercent / 100);
  return measuredAvgFps < floor;
}

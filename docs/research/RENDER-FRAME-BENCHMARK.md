# Render frame benchmark (ARQ-151)

## Purpose

Blueprint section 120's "local project interactive under 2 seconds after data
is available" target - distinct from `panZoomFpsTarget` (ARQ-115/116/117),
which deliberately excludes exactly this cost from its own stats (its own doc
comment: warm-up/first-paint is "a one-time, cold-start expense... not part of
ongoing pan/zoom frame rate").

## Method

- Reuses the same real benchmark page ARQ-115's Canvas 2D pan/zoom benchmark
  already drives (`packages/plan-renderer/benchmarks/canvas-2d/canvas-2d-benchmark.html`)
  rather than building a second harness - this issue only adds one more
  measurement to it: `timeToFirstFrameMs`, captured from right after
  `buildScene()` returns (data available) to the first completed `render()`
  call (first frame painted).
- Driven the same way as every other renderer benchmark in this repository:
  `scripts/run-render-frame-benchmark.mjs`, Playwright, real headless
  Chromium, no estimate.
- Canvas 2D specifically, since that is the ADR-0008-selected production 2D
  renderer (ARQ-118) - this is what a real user's first frame would actually
  run.

## Result (2026-07-23, CI reference environment - see `benchmarks/PERFORMANCE-BUDGETS.json`'s `benchmarkDevice`)

Three consecutive runs:

| Run | timeToFirstFrameMs | Target  | Meets target? |
| --- | ------------------ | ------- | ------------- |
| 1   | 70.4 ms            | 2000 ms | yes           |
| 2   | 21.8 ms            | 2000 ms | yes           |
| 3   | 29.8 ms            | 2000 ms | yes           |

**Verdict: comfortably meets target in this environment** - the worst of the
three runs (70.4 ms) is roughly 28x below the 2 second target.

## Regression tracking

Recorded in `benchmarks/PERFORMANCE-BUDGETS.json`'s `ciBaselines` as
`timeToFirstFrameMs`, using the **highest** (most conservative) of the three
runs as the baseline - the opposite choice from `panZoomAvgFps` (which uses the
lowest fps), since for a latency metric higher is worse, so the worst observed
value is the correct conservative floor to regress from. A generous 200%
threshold applies for the same reason as the selection and room-rebuild
benchmarks: enormous headroom below the absolute target makes a tight
percentage threshold noise, not signal.

## Caveat

Like every other renderer benchmark in this repository, this measures one real
but sandboxed, software-rendered CI environment, not one of section 121's
supported-device-matrix tiers - see `docs/adr/0008-rendering-strategy.md` and
every other `RENDERER-BENCHMARK-*.md`'s own "Important caveat".

# Room rebuild benchmark (ARQ-150)

## Purpose

Blueprint section 120's "room recalculation median under 150 ms for one wall
move" target, measured against the real room-boundary pipeline:
`traceRoomBoundary` (`packages/geometry-2d/src/room-boundary-graph.ts`,
ARQ-111) plus `polygonArea` (`polygon-area.ts`, ARQ-085) - the same two
functions `room-placement-tool.ts` (`@arq/editor-shell`, ARQ-112) already calls
in production.

## Method

- Scene: a full wall-centreline grid, 10 columns x 6 rows of 4m x 3m cells,
  matching `benchmarks/PERFORMANCE-BUDGETS.json`'s `benchmarkModel` room count
  (60). Built from _unit_ segments - one per grid cell edge, sharing exact
  endpoints at every intersection - since `traceRoomBoundary`'s half-edge
  graph only merges vertices that already coincide within tolerance; it does
  not split a long edge where another edge crosses it. This yields 136 wall
  segments, close to (not artificially padded to) the benchmark model's 150 -
  padding with segments that do not participate in any real room boundary
  would not make the benchmark more faithful.
- "One wall move" is simulated by re-tracing a single room's boundary from the
  already-built grid - a wall move invalidates exactly one room's boundary per
  section 36's "derived dependency graph", not the whole project, so this
  benchmark measures one targeted room recalculation, not all 60 at once.
- 200 trials, real `performance.now()` timings, **median** reported, matching
  section 120's own wording.
- No browser needed: boundary tracing and area calculation are pure
  computation. Runs as a normal Vitest test
  (`packages/geometry-2d/src/room-rebuild-benchmark.test.ts`).
- Correctness is checked too, not just speed: one targeted room's boundary and
  area are asserted directly, and a separate test traces all 60 grid cells and
  confirms every one resolves to a valid room boundary.

## Result (2026-07-22, CI reference environment - see `benchmarks/PERFORMANCE-BUDGETS.json`'s `benchmarkDevice`)

| Grid                                   | Trials | Median  | Target |
| -------------------------------------- | ------ | ------- | ------ |
| 136 walls, 60 rooms, one room retraced | 200    | 0.63 ms | 150 ms |

**Verdict: comfortably meets target in this environment** - roughly 238x
headroom below the 150 ms target.

## Regression tracking

Recorded in `benchmarks/PERFORMANCE-BUDGETS.json`'s `ciBaselines` as
`roomRecalculateMedianMs`, with the same deliberately generous 200%
regression-threshold reasoning ARQ-149's selection benchmark used: at 0.63 ms
against a 150 ms absolute target, the real gate is the absolute target
asserted directly in the test, not a tight percentage baseline.

## Caveat

Like every other benchmark in this repository, this measures one real but
sandboxed CI environment, not one of section 121's supported-device-matrix
tiers. As with the selection benchmark (ARQ-149), the headroom here is large
enough that this caveat matters less than it does for the GPU-bound renderer
benchmarks (ARQ-115 through ARQ-117).

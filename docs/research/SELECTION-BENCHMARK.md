# Selection benchmark (ARQ-149)

## Purpose

Blueprint section 120's protected benchmark model ("approximately 1,000 semantic
objects": 150 walls, 80 openings, 60 rooms, 200 annotations) and its "selection
median under 50 ms" target, measured against the real `pickAt` function
(`packages/editor-shell/src/hit-test.ts`, ARQ-039) - not a reimplementation.

## Method

- 150 candidates: real segment-based `HitTestable`s (walls), using
  `@arq/geometry-2d`'s `closestPointOnSegment` - the same distance calculation
  `nearest-snap.ts` already uses in production.
- 850 candidates: point-based `HitTestable`s (`createPointHitTestable`, ARQ-040),
  reaching section 120's "approximately 1,000" total. `pickAt`'s own performance
  characteristic - a linear scan calling each candidate's O(1) `hitTest` - does
  not meaningfully differ by candidate shape, so this mix is a faithful stand-in
  for "clicking among ~1,000 objects."
- Worst case measured: a click point guaranteed to hit nothing, so `pickAt` must
  scan every one of the ~1,000 candidates before giving up.
- 500 trials, real `performance.now()` timings, **median** (not average) reported -
  matching section 120's own wording exactly.
- No browser needed: hit-testing is pure computation, unlike ARQ-115/116/117's
  renderer benchmarks. Runs as a normal Vitest test in this repository's real CI
  environment (`packages/editor-shell/src/selection-benchmark.test.ts`).

## Result (2026-07-22, CI reference environment - see `benchmarks/PERFORMANCE-BUDGETS.json`'s `benchmarkDevice`)

| Candidates                       | Trials | Median   | Target |
| -------------------------------- | ------ | -------- | ------ |
| ~1,000 (150 segment + 850 point) | 500    | 0.035 ms | 50 ms  |

**Verdict: comfortably meets target in this environment** - roughly 1,400x
headroom below the 50 ms target, consistent with hit-testing being O(n) trivial
arithmetic over realistic object counts rather than anything I/O- or
render-bound.

## Regression tracking

Recorded in `benchmarks/PERFORMANCE-BUDGETS.json`'s `ciBaselines` as
`selectionMedianMs`, with a deliberately generous 200% regression threshold: at
0.035 ms against a 50 ms absolute target, a tight percentage threshold on this
number would be noise, not signal. The real gate is the 50 ms absolute target,
asserted directly as a hard `expect()` in the benchmark test itself - a genuine
regression (e.g. an accidental O(n²) change to `pickAt`) would need to be
roughly 1,400x slower before even approaching that absolute target, which the
percentage baseline alone would not reliably catch at this scale.

## Caveat

Like every other benchmark in this repository, this measures one real but
sandboxed CI environment, not one of section 121's supported-device-matrix
tiers. Given the enormous headroom here, that caveat matters far less for this
particular target than it does for the renderer/GPU-bound benchmarks (ARQ-115
through ARQ-117) - pure-CPU arithmetic at this object count is unlikely to
behave qualitatively differently on real end-user hardware.

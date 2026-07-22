# Renderer spike: Canvas 2D benchmark (ARQ-115)

## Purpose

Blueprint section 61 ("2D renderer decision") recommends spiking Canvas 2D,
PixiJS WebGL, and (if needed) CanvasKit against the protected benchmark
before selecting a 2D renderer via ADR (ARQ-118). This is the Canvas 2D
half of that spike. PixiJS (ARQ-116) and CanvasKit (ARQ-117) are separate,
later issues.

## Method

- Scene: a synthetic plan generated deterministically to match
  `benchmarks/PERFORMANCE-BUDGETS.json`'s `benchmarkModel` object counts
  exactly - 150 walls, 80 doors/windows, 60 rooms, 200 annotations (a
  10x6 grid of 4m x 3m rooms, not a real floor plan; the object *count*
  is what stresses per-frame draw-call volume, not the layout's realism).
  Generator: `packages/plan-renderer/benchmarks/canvas-2d/scene.js`.
- Renderer: plain Canvas 2D (`CanvasRenderingContext2D`), no library -
  fills for rooms, `fillRect` for walls/openings, `fillText` for
  annotations and room labels. `packages/plan-renderer/benchmarks/canvas-2d/canvas-2d-benchmark.html`.
- Workload: a full-scene redraw every animation frame while panning (the
  viewport offset increments each frame) for 180 frames - full redraw
  with no dirty-rect optimisation is the worst case a Canvas 2D renderer
  faces, and is exactly section 120's "pan and zoom 60 fps target"
  scenario.
- Driver: `scripts/run-canvas-2d-benchmark.mjs`, using Playwright to run
  the page in real headless Chromium (`/opt/pw-browsers/chromium`) and
  read back `window.__ARQ_BENCHMARK_RESULT__` - actual measured frame
  times from a real browser, not an estimate.

## Results

Three consecutive runs (2026-07-22), full JSON in `benchmarks/results/`:

| Run | avg fps | avg frame (ms) | p95 frame (ms) | max frame (ms) |
|---|---|---|---|---|
| 1 | 57.76 | 17.31 | 16.80 | 83.30 |
| 2 | 58.70 | 17.04 | n/a | 50.00 |
| 3 | 59.67 | 16.76 | n/a | 33.30 |

Object counts produced by the generator matched the benchmark model
exactly in every run (150 walls, 60 rooms, 80 openings, 200 annotations).

Target (`benchmarks/PERFORMANCE-BUDGETS.json`, `panZoomFpsTarget`): 60 fps.

**Verdict: marginal / just under target in this environment** (57.8-59.7
fps average across three runs, i.e. within about 1-4% of 60 fps) - close
enough that a real GPU-accelerated device (section 121's supported
device matrix) plausibly clears 60 fps for this object count, but not
proven here.

## Important caveat

This ran in a headless, sandboxed container with software (CPU)
rendering, not on any device from section 121's supported device matrix.
`benchmarks/PERFORMANCE-BUDGETS.json` itself says targets are "planning
targets until measured" - this spike does not change that: it is a
same-order-of-magnitude signal (Canvas 2D redraw of this object count is
in the tens-of-milliseconds-per-frame range, near the 16.7 ms/frame
budget for 60 fps) collected honestly in this environment, not a
certified pass/fail result on approved hardware. ARQ-116/117 need the
same caveat, and ARQ-118's ADR should weigh all three spikes' numbers
as comparative signal, not as final performance claims.

## Reproducing

```
node scripts/run-canvas-2d-benchmark.mjs
```

Requires the `playwright` dev dependency (added for this spike - see
`open-source/TECHNOLOGY-MATRIX.csv`) and the pre-installed Chromium at
`PLAYWRIGHT_BROWSERS_PATH` (or set `PLAYWRIGHT_CHROMIUM_PATH` to a
different executable).

# Renderer spike: Canvas 2D benchmark (ARQ-115)

## Purpose

Blueprint section 61 ("2D renderer decision") recommends spiking Canvas 2D,
PixiJS WebGL (ARQ-116), and CanvasKit (ARQ-117, if needed) against the
protected benchmark before selecting a 2D renderer via ADR (ARQ-118). This
is the Canvas 2D half.

## Method

- Scene: a synthetic plan generated deterministically to match
  `benchmarks/PERFORMANCE-BUDGETS.json`'s `benchmarkModel` object counts
  exactly - 150 walls, 80 doors/windows, 60 rooms, 200 annotations (a
  10x6 grid of 4m x 3m rooms, not a real floor plan; the object _count_
  is what stresses per-frame draw-call volume, not the layout's realism).
  Generator: `packages/plan-renderer/benchmarks/canvas-2d/scene.js`
  (shared unchanged with the PixiJS spike, ARQ-116).
- Renderer: plain Canvas 2D (`CanvasRenderingContext2D`), no library -
  fills for rooms, `fillRect` for walls/openings, `fillText` for
  annotations and room labels. `packages/plan-renderer/benchmarks/canvas-2d/canvas-2d-benchmark.html`.
- Workload: a full-scene redraw every animation frame while panning (the
  viewport offset increments each frame) - full redraw with no
  dirty-rect optimisation is the worst case a Canvas 2D renderer faces,
  and is exactly section 120's "pan and zoom 60 fps target" scenario.
  The first 30 frames render but are excluded from the timing stats
  (JIT/first-paint warm-up is a one-time cost, covered by section 120's
  separate "local project interactive under 2 seconds" budget, not
  ongoing pan/zoom frame rate); the next 180 frames are measured.
- Driver: `scripts/run-canvas-2d-benchmark.mjs`, using Playwright to run
  the page in real headless Chromium (`/opt/pw-browsers/chromium`) and
  read back `window.__ARQ_BENCHMARK_RESULT__` - actual measured frame
  times from a real browser, not an estimate.

## Results

Three consecutive runs (2026-07-22), full JSON in `benchmarks/results/`:

| Run | avg fps | avg frame (ms) | p95 frame (ms) | max frame (ms) |
| --- | ------- | -------------- | -------------- | -------------- |
| 1   | 60.00   | 16.67          | 16.80          | 16.80          |
| 2   | 60.00   | 16.67          | 16.70          | 16.80          |
| 3   | 59.35   | 16.85          | 16.80          | 33.40          |

Object counts produced by the generator matched the benchmark model
exactly in every run (150 walls, 60 rooms, 80 openings, 200 annotations).

Target (`benchmarks/PERFORMANCE-BUDGETS.json`, `panZoomFpsTarget`): 60 fps.

**Verdict: meets target in this environment.** All three runs land at or
within 1.1% of 60 fps, with per-frame time consistently around the
16.7 ms budget one frame needs for 60 fps - Canvas 2D comfortably keeps
up with this object count doing a full immediate-mode redraw every
frame, in this environment.

## Important caveat

This ran in a headless, sandboxed container with software (CPU)
rendering, not on any device from section 121's supported device matrix.
`benchmarks/PERFORMANCE-BUDGETS.json` itself says targets are "planning
targets until measured" - this spike does not change that: it is a
real, reproducible signal collected honestly in this environment, not a
certified pass/fail result on approved hardware. ARQ-116/117 need the
same caveat, and ARQ-118's ADR should weigh all spikes' numbers as
comparative signal, not as final performance claims. See
`docs/research/RENDERER-BENCHMARK-PIXIJS-WEBGL.md` (ARQ-116) for the
comparison point and why raw fps numbers between the two spikes should
not be read as "Canvas 2D beats WebGL in general."

## Revision note

An earlier version of this benchmark did not exclude a warm-up period,
which let first-paint cost skew the average on some runs. The
methodology above (30 warm-up frames excluded, 180 measured) was
adopted for both this spike and ARQ-116's, and this document's numbers
reflect the corrected methodology.

## Reproducing

```
node scripts/run-canvas-2d-benchmark.mjs
```

Requires the `playwright` dev dependency (added for this spike - see
`open-source/TECHNOLOGY-MATRIX.csv`) and the pre-installed Chromium at
`PLAYWRIGHT_BROWSERS_PATH` (or set `PLAYWRIGHT_CHROMIUM_PATH` to a
different executable).

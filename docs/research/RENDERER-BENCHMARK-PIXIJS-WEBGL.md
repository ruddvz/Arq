# Renderer spike: PixiJS WebGL benchmark (ARQ-116)

## Purpose

Blueprint section 61 ("2D renderer decision") recommends spiking Canvas
2D (ARQ-115), PixiJS WebGL, and CanvasKit (ARQ-117, if needed) against
the protected benchmark before selecting a 2D renderer via ADR
(ARQ-118). This is the PixiJS WebGL half.

## Method

- Scene: the same deterministic synthetic scene as ARQ-115
  (`packages/plan-renderer/benchmarks/canvas-2d/scene.js`, unchanged) -
  150 walls, 80 doors/windows, 60 rooms, 200 annotations, matching
  `benchmarks/PERFORMANCE-BUDGETS.json`'s `benchmarkModel` exactly.
- Renderer: PixiJS 8.19.0 (`pixi.js`, MIT, added as a dev dependency for
  this spike - `open-source/TECHNOLOGY-MATRIX.csv` already listed it as
  a planned "spike" entry). Unlike ARQ-115's Canvas 2D immediate-mode
  redraw, the scene's `Graphics`/`Text` objects are built **once** as
  PixiJS display objects, and each frame only moves the container's
  x/y before calling `renderer.render()` - the natural way a
  retained-mode 2D GPU renderer is used. This is a deliberate
  difference from the Canvas 2D spike's methodology, not an
  inconsistency: section 61 itself frames Canvas 2D's weakness as
  "manual retained scene" versus PixiJS's "high-performance retained
  display," so each spike exercises its own technology's actual shape.
  `packages/plan-renderer/benchmarks/pixijs-webgl/pixijs-webgl-benchmark.html`.
- Workload and warm-up: identical pan simulation and 30-warm-up /
  180-measured frame split as ARQ-115, for a fair comparison.
- Driver: `scripts/run-pixijs-webgl-benchmark.mjs` (Playwright, real
  headless Chromium). PixiJS's prebuilt UMD bundle
  (`node_modules/pixi.js/dist/pixi.min.js`) is injected directly via
  `page.addScriptTag` rather than vendored into the repo. Chromium is
  launched with `--use-gl=swiftshader --enable-webgl
--ignore-gpu-blocklist`, since this container has no real GPU -
  without these flags WebGL is unavailable at all in this environment.

## Results

Three consecutive runs (2026-07-22), full JSON in `benchmarks/results/`:

| Run | avg fps | avg frame (ms) | p95 frame (ms) | max frame (ms) |
| --- | ------- | -------------- | -------------- | -------------- |
| 1   | 16.39   | 61.02          | 83.30          | 83.40          |
| 2   | 17.34   | 57.68          | 83.40          | 83.40          |
| 3   | 16.54   | 60.46          | 83.40          | 133.30         |

Object counts matched the benchmark model exactly in every run.

Target (`benchmarks/PERFORMANCE-BUDGETS.json`, `panZoomFpsTarget`): 60 fps.

**Verdict in this environment: fails target, by a wide margin** (16-17
fps average, roughly a quarter of the 60 fps target) - but see the
caveat below before drawing any conclusion about PixiJS/WebGL itself.

## Critical caveat: this measures software WebGL, not PixiJS

This container has no GPU. Chromium falls back to SwiftShader, a
software (CPU) implementation of the WebGL API - confirmed directly
(`gl.getParameter(gl.RENDERER)` reports `"WebKit WebGL"` /
`"WebGL 2.0 (OpenGL ES 3.0 Chromium)"` over software rasterisation, not
a real GPU renderer string). PixiJS's entire performance case rests on
offloading rasterisation to real GPU hardware; a software WebGL
fallback defeats that case by construction; it is a reasonable, known
result that a full software GPU-pipeline emulation (SwiftShader) is
slower for this object count than a native, mature CPU 2D rasteriser
(Canvas 2D/Skia) - **that is a statement about this sandboxed
environment, not a general finding that "Canvas 2D beats PixiJS."**

Because of this, the numeric comparison against ARQ-115's Canvas 2D
result (60 fps) must not be read as "Canvas 2D is the better choice" -
it can only honestly be read as "this container cannot evaluate
WebGL's real advantage, because it cannot exercise a real GPU." ARQ-118's
ADR needs a run on section 121's actual supported-device matrix (real
GPU hardware) before PixiJS's numbers can be weighed fairly against
Canvas 2D's.

A secondary, genuinely transferable finding, independent of the
software/hardware caveat: WebGL/PixiJS has a real, one-time warm-up
cost (context creation, shader compilation, initial texture uploads)
that Canvas 2D does not - an early, pre-warm-up-exclusion run of this
same benchmark measured a 9.7-second single frame on first render,
entirely absent once the first ~30 frames are excluded from timing (see
this document's sibling, `RENDERER-BENCHMARK-CANVAS-2D.md`'s revision
note). Any real renderer-selection decision should budget for this
during initial scene load, not just steady-state frame rate.

## Reproducing

```
node scripts/run-pixijs-webgl-benchmark.mjs
```

Requires the `pixi.js` dev dependency (added for this spike, MIT
licence - see `open-source/TECHNOLOGY-MATRIX.csv`/`.json`), the
`playwright` dev dependency (ARQ-115), and the pre-installed Chromium at
`PLAYWRIGHT_BROWSERS_PATH` (or set `PLAYWRIGHT_CHROMIUM_PATH`).

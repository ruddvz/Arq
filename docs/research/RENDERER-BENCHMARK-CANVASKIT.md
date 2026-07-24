# Renderer spike: CanvasKit evaluation (ARQ-117)

## Purpose

Blueprint section 61 ("2D renderer decision") recommends spiking Canvas
2D (ARQ-115) and PixiJS WebGL (ARQ-116) first, evaluating CanvasKit "if
the first two fail protected tests," before selecting a 2D renderer via
ADR (ARQ-118). Canvas 2D actually met the 60 fps target in this
environment (see `RENDERER-BENCHMARK-CANVAS-2D.md`), so this evaluation
is not strictly triggered by that literal condition - it is completed
anyway because this issue's own acceptance criteria require it
regardless, and because PixiJS's failure was shown to be an artifact of
this container having no real GPU (see `RENDERER-BENCHMARK-PIXIJS-WEBGL.md`),
which leaves CanvasKit's own comparison genuinely useful context for
ARQ-118.

## Method

- Scene: the same deterministic synthetic scene as ARQ-115/116
  (`packages/plan-renderer/benchmarks/canvas-2d/scene.js`, unchanged) -
  150 walls, 80 doors/windows, 60 rooms, 200 annotations, matching
  `benchmarks/PERFORMANCE-BUDGETS.json`'s `benchmarkModel` exactly.
- Renderer: `canvaskit-wasm` 0.41.1 (BSD-3-Clause, added as a dev
  dependency for this spike). Uses `CanvasKit.MakeSWCanvasSurface` -
  Skia's own CPU software rasteriser - rather than a WebGL-backed
  surface: this container has no real GPU (established in ARQ-116's
  spike), so a WebGL-backed CanvasKit surface would only remeasure that
  same limitation. The software surface asks the fair, GPU-agnostic
  question this environment can actually answer: how does Skia's own
  rasteriser (via WASM) compare to the browser's native Canvas 2D
  rasteriser. Like Canvas 2D, the full scene is redrawn every frame
  (immediate-mode, matching how a Skia canvas is normally used), unlike
  PixiJS's retained display list.
  `packages/plan-renderer/benchmarks/canvaskit/canvaskit-benchmark.html`.
- Text: CanvasKit does not use system/browser fonts - it needs real font
  bytes. This uses the container's installed DejaVu Sans
  (`/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`, Bitstream Vera/Arev
  licence, freely redistributable), read at benchmark-run-time and
  served locally, not vendored into the repo - the same
  "environment-provided asset" stance already taken for
  Chromium/Playwright.
- Serving: CanvasKit's `.wasm` binary and the font must be fetched over
  http(s) (file:// relative fetches are unreliable in Chromium), so
  `scripts/run-canvaskit-benchmark.mjs` runs a tiny static file server
  for the benchmark's duration, serving the scene generator, the
  benchmark HTML, CanvasKit's prebuilt `bin/` directory straight from
  `node_modules` (not vendored), and the system font.
- Workload and warm-up: identical pan simulation and 30-warm-up /
  180-measured frame split as ARQ-115/116, for a fair comparison.
- Driver: `scripts/run-canvaskit-benchmark.mjs` (Playwright, real
  headless Chromium).

## Results

Three consecutive runs (2026-07-22), full JSON in `benchmarks/results/`:

| Run | avg fps | avg frame (ms) | p95 frame (ms) | max frame (ms) |
| --- | ------- | -------------- | -------------- | -------------- |
| 1   | 39.71   | 25.18          | 33.40          | 66.80          |
| 2   | 42.03   | 23.79          | 33.40          | 50.00          |
| 3   | 43.03   | 23.24          | 33.40          | 50.00          |

Object counts matched the benchmark model exactly in every run.

Target (`benchmarks/PERFORMANCE-BUDGETS.json`, `panZoomFpsTarget`): 60 fps.

**Verdict in this environment: fails target** (40-43 fps average,
roughly two-thirds of the 60 fps target) - slower than Canvas 2D's ~60
fps, but substantially faster than PixiJS's software-WebGL result
(~16-17 fps) from the same container.

## Interpreting the three-way comparison

All three spikes ran on the same hardware (this sandboxed, GPU-less
container), so the _relative_ ordering among them is a real,
reproducible signal even though none of the absolute numbers are
certified device measurements:

1. **Canvas 2D (~60 fps)** - Chromium's own native, highly-optimised 2D
   rasteriser (itself Skia-backed internally), called directly with no
   extra binding layer.
2. **CanvasKit/Skia-via-WASM (~40 fps)** - the same underlying rendering
   technology family as (1) (Skia), but paying a real cost for the
   JS-to-WASM call boundary on every draw call and for running inside a
   WASM sandbox rather than natively.
3. **PixiJS/WebGL-via-SwiftShader (~16 fps)** - not a fair reading of
   PixiJS itself (see the critical caveat in
   `RENDERER-BENCHMARK-PIXIJS-WEBGL.md`): this number reflects a full
   software emulation of the entire GPU pipeline, which is a much
   heavier tax than either of the above pays.

The one-sided conclusion this environment _can_ support: for this
object count, going through an extra binding/sandbox boundary (WASM, or
a fully-emulated GPU pipeline) costs real, measurable frame time
compared to the browser's native, direct-call 2D API. It cannot support
a conclusion about CanvasKit or PixiJS's performance on real target
hardware (section 121's supported device matrix), where WebGL gets
actual GPU offload and the tradeoff could look very different.

## Reproducing

```
node scripts/run-canvaskit-benchmark.mjs
```

Requires the `canvaskit-wasm` dev dependency (added for this spike,
BSD-3-Clause - see `open-source/TECHNOLOGY-MATRIX.csv`/`.json`), the
`playwright` dev dependency (ARQ-115), the pre-installed Chromium at
`PLAYWRIGHT_BROWSERS_PATH`, and a DejaVu Sans font installed at
`/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf` (standard on this
container/most Linux distributions).

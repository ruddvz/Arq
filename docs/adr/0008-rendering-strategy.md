# ADR-0008: Rendering strategy

**Status:** Proposed (2D renderer choice evidence-backed; pending real-device validation before Accepted)
**Date:** 2026-07-22
**Owners:** To assign
**Decision:** Canvas 2D as the first production 2D renderer, behind a renderer abstraction; PixiJS WebGL is the documented upgrade path, not the initial choice

## Context

Blueprint section 61 ("2D renderer decision") lays out four candidates
(Canvas 2D, SVG, PixiJS, CanvasKit) and recommends: "Build a renderer
abstraction and spike: 1. Canvas 2D; 2. PixiJS WebGL; 3. CanvasKit if
the first two fail protected tests." ARQ-115/116/117 carried out exactly
that sequence against the protected benchmark
(`benchmarks/PERFORMANCE-BUDGETS.json`'s `benchmarkModel`: 150 walls, 80
doors/windows, 60 rooms, 200 annotations) and its `panZoomFpsTarget` (60
fps). This ADR records the decision those three spikes support.

Section 61 separately states a "Likely first production choice" of
"PixiJS or a custom WebGL renderer for interaction... WebGL backend by
default." That text pre-dates any benchmark evidence. The decision
below updates it based on what was actually measured - see
"Deviation from the blueprint's prior framing" below.

## Options

1. **Canvas 2D** - simple, mature, good text, low initial complexity;
   CPU-bound, no retained scene, harder large-scene performance, manual
   hit testing (section 61's own framing).
2. **PixiJS WebGL** - MIT, WebGL/WebGPU backends, high-performance
   retained display, interaction utilities; not a CAD engine, technical
   line quality needs work, vector export needs a separate pipeline
   (section 61's own framing).
3. **CanvasKit** - Skia quality, strong 2D drawing, WASM; larger
   payload, manual integration, text/resource lifecycle complexity
   (section 61's own framing).

## Evidence (ARQ-115/116/117)

All three ran the identical synthetic scene (matching the protected
benchmark's object counts exactly) and the identical pan workload (full
redraw of the scene, panning, 30 warm-up frames excluded, 180 frames
measured), in this container (headless Chromium, no real GPU - software
WebGL via SwiftShader). Three runs each:

| Renderer                                           | avg fps (3 runs) | Meets 60 fps target here? |
| -------------------------------------------------- | ---------------- | ------------------------- |
| Canvas 2D (ARQ-115)                                | 59.3-60.0        | Yes                       |
| PixiJS WebGL (ARQ-116)                             | 16.4-17.3        | No                        |
| CanvasKit / Skia-via-WASM, SW rasteriser (ARQ-117) | 39.7-43.0        | No                        |

Full methodology and results: `docs/research/RENDERER-BENCHMARK-CANVAS-2D.md`,
`RENDERER-BENCHMARK-PIXIJS-WEBGL.md`, `RENDERER-BENCHMARK-CANVASKIT.md`.

**The PixiJS and CanvasKit numbers above are not evidence those
technologies are inferior in general** - this container has no GPU, so
PixiJS's WebGL path and a WebGL-backed CanvasKit surface can only be
measured through a full software GPU-pipeline emulation, which both
research docs flag explicitly as an unfair, non-representative
condition for a GPU-accelerated technology. What the evidence _does_
support, honestly: for the protected benchmark's specific object count,
run in this environment, Canvas 2D alone already clears the pan/zoom
target, with none of the added integration cost (WASM payload, custom
font loading, GPU driver dependency) the other two carry.

## Decision

Adopt a renderer abstraction (per section 61's own recommendation) with
**Canvas 2D as the v1 (first production) 2D renderer backend**. This is
not a rejection of PixiJS/WebGL - it is a "don't pay for headroom you
haven't shown you need yet" call, directly following blueprint section
61's own decision procedure: Canvas 2D did not fail the protected
benchmark, so per that procedure there is no basis yet to reach for
PixiJS or CanvasKit's added complexity.

CanvasKit is not adopted at this stage: even setting aside the
no-real-GPU caveat, it measured worse than Canvas 2D on every run, and
requires meaningfully more integration work (it does not use system
fonts at all; it ships an ~800 KB WASM payload) for no demonstrated
benefit at this scene size.

## Deviation from the blueprint's prior framing

Section 61 also states a "likely first production choice" of PixiJS or
a custom WebGL renderer, written before any benchmark existed. This ADR
updates that framing based on the ARQ-115/116/117 evidence above, not
in spite of it: the blueprint's own stated selection procedure (spike
Canvas 2D first; only reach for WebGL/CanvasKit if it fails) is what
this decision follows. The renderer abstraction requirement is kept
specifically so this can be revisited without a rewrite - see
Rollback.

## Consequences

- **Technical:** No WebGL/WebGPU dependency, no WASM payload, no GPU
  driver variability to support for v1 rendering. Manual hit testing
  and no retained scene remain real Canvas 2D costs the renderer
  abstraction and `plan-renderer` package must account for (dirty-rect
  or partial-redraw strategies as scene complexity grows past the
  protected benchmark's size).
- **Product:** Faster, simpler path to a working plan view for the
  first release; text rendering quality (a section 61 PixiJS con) comes
  "for free" from Canvas 2D's native font handling.
- **Operational/licence:** No new runtime dependency for v1 (Canvas 2D
  is a browser built-in). `pixi.js` (MIT) and `canvaskit-wasm`
  (BSD-3-Clause) stay recorded in `open-source/TECHNOLOGY-MATRIX.csv`/
  `.json` as spiked-but-not-yet-adopted, available for the upgrade path
  below without a fresh licence review.
- **Migration difficulty if this changes:** Low-to-medium, _if_ the
  renderer abstraction (blueprint section 60, ARQ-119) is actually
  built as a real seam (plan primitives/annotation primitives/visibility
  state/selection state/style tokens, consumed by a swappable renderer)
  rather than Canvas 2D calls scattered through the editor. That
  abstraction is this decision's real safeguard, not an afterthought.

## Validation

- Spikes complete and recorded (ARQ-115/116/117) with real, reproducible
  measured evidence - not benchmark output invented for this ADR.
- Decision register (`docs/product/DECISION-REGISTER.csv`) D-005
  updated from "WebGL first, WebGPU optional" to reflect this decision
  and its evidence, still marked provisional pending device validation
  (see Rollback).
- **Outstanding before this can move to Accepted:** a run of all three
  spikes on an actual device from section 121's supported device
  matrix (real GPU). `benchmarks/PERFORMANCE-BUDGETS.json` itself
  states targets are "planning targets until measured" - this ADR does
  not change that; it is the best decision the _available_ evidence
  supports, not a claim that hardware validation is unnecessary.
- Package specification: `packages/plan-renderer`'s README should be
  updated to reflect "Canvas 2D first backend, behind a renderer
  abstraction" once ARQ-119 (plan scene abstraction) is implemented -
  not done as part of this ADR, since plan-renderer has no
  implementation yet for this decision to attach to.

## Rollback

Because the renderer abstraction (not raw Canvas 2D calls) is the unit
every editor/plan-renderer feature is meant to depend on, switching the
v1 backend to PixiJS WebGL later is a matter of implementing a second
backend behind the same abstraction and changing which one is
instantiated - not rewriting call sites. No project data is affected:
this decision is entirely about how the plan view is drawn, never about
what is stored (blueprint section 60's "renderer-neutral scene
description" already keeps project semantics independent of any
renderer, per ADR-0002/this repository's package-boundary rules).

## Related issues

ARQ-115 (benchmark Canvas 2D), ARQ-116 (benchmark PixiJS WebGL),
ARQ-117 (evaluate CanvasKit fallback), ARQ-118 (this ADR), ARQ-119
(implement plan scene abstraction, the concrete renderer-abstraction
seam this decision depends on).

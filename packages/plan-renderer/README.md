# @arq/plan-renderer

2D plan/section/elevation renderer producing crisp technical linework.

Not yet implemented - placeholder created while aligning the workspace with
docs/architecture/REPOSITORY-STRUCTURE.md and docs/architecture/PACKAGE-BOUNDARIES.md.

Renderer choice: see docs/adr/0008-rendering-strategy.md (ARQ-118) -
Canvas 2D is the decided v1 backend, behind a renderer abstraction
(ARQ-119, not yet implemented); PixiJS WebGL is the documented upgrade
path. Benchmark spikes and evidence: docs/research/RENDERER-BENCHMARK-CANVAS-2D.md,
RENDERER-BENCHMARK-PIXIJS-WEBGL.md, RENDERER-BENCHMARK-CANVASKIT.md.
Standalone benchmark harnesses (not part of this package's build) live
under benchmarks/ in this directory.

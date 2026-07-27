# @arq/plan-renderer

2D plan rendering: the renderer-neutral `PlanScene` abstraction (ARQ-119) and
the Canvas 2D backend chosen by ADR-0008 (see
docs/adr/0008-rendering-strategy.md; PixiJS WebGL remains the documented
upgrade path, with benchmark evidence under docs/research/ and standalone
harnesses under benchmarks/ in this directory).

Implemented: `buildPlanScene` (visibility/selection/lock resolved into style
tokens), `paintPlanScene` (Canvas 2D painting with device-pixel-ratio-aware
line weights), selection handle rendering (ARQ-121), snap glyphs and labels
(ARQ-120), room labels, sheet viewports, line-weight mapping, and a
benchmark-regression test against `benchmarks/PERFORMANCE-BUDGETS.json`.
Consumed by `apps/web`'s interactive `PlanCanvas`.

Known limits: the Canvas 2D style-token palette resolves the brand colours
only - hover/warning/error/imported/proposed currently paint as default (see
`canvas2d-paint.ts`); no builder exists yet from `@arq/bim-core` elements to
`PlanScene` (callers hand-assemble primitive inputs).

---
name: zeus-renderer-performance
description: Use for Arq 2D or 3D renderer choices, scene projection, workers, GPU resources, frame time, memory or benchmark claims.
---

# zeus-renderer-performance

Invariants 37 to 43 govern this work. Renderer objects are projections. A performance
claim names metric, percentile, dataset, hardware and environment or it is not a claim.

## Source of truth

`.zeus/modules/rendering.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

COMPARE, OPTIMIZE, PARETO. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

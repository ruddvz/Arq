---
name: zeus-geometry-kernel
description: Use for Arq topology, boolean operations, offsets, intersections, wall joins, openings, solids, meshes or geometry library decisions.
---

# zeus-geometry-kernel

Invariants 27 to 31 govern this work. Separate semantic intent from kernel
representation, and route `arq-geometry-reviewer` for anything that changes topology.

## Source of truth

`.zeus/modules/geometry.md` and `.zeus/INVARIANTS.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

COMPARE, RISKMAP, BLACKSWAN. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

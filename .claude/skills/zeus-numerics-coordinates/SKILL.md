---
name: zeus-numerics-coordinates
description: Use for Arq precision, canonical units, transforms, large coordinates, origin shifting, tolerances, snapping mathematics or cross-platform determinism.
---

# zeus-numerics-coordinates

Units, precision, origin strategy, coordinate spaces and tolerances are declared, never
resolved incidentally. No ad hoc floating-point equality on geometry.

## Source of truth

`.zeus/modules/geometry.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

HIDDENASSUMPTIONS, BLACKSWAN. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

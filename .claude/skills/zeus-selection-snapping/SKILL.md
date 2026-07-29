---
name: zeus-selection-snapping
description: Use for Arq picking, hit testing, selection sets, snapping, guides, handles, filters or deterministic priority conflicts.
---

# zeus-selection-snapping

Selection and snapping are deterministic under a declared priority and tolerance model.
Picking resolves back to stable semantic IDs and respects visibility, level and filters.

## Source of truth

`.zeus/modules/editor-input.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

/simulate, REDTEAM. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

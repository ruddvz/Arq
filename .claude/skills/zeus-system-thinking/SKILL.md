---
name: zeus-system-thinking
description: Use when Arq work crosses the semantic model, editor, renderer, persistence, workers, sync, export, AI or several user roles.
---

# zeus-system-thinking

Map state owners and boundaries before changing any of them. Most cross-cutting defects
are ownership defects wearing a different costume.

## Source of truth

`.zeus/INVARIANTS.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

SYSTEMMAP, SECONDORDER, FRACTAL. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

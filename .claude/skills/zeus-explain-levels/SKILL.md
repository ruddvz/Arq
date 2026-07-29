---
name: zeus-explain-levels
description: Use when explaining an Arq concept at a requested level, with analogies, worked examples, misconceptions or teaching structure.
---

# zeus-explain-levels

Pick the level explicitly and stay there. An analogy that breaks at the first edge case
is worse than no analogy.

## Source of truth

`.zeus/method-registry.json`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

FEYNMAN, MISCONCEPTIONS, /examples. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

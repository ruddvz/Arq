---
name: zeus-deep-analysis
description: Use for consequential Arq work that explicitly requires deep, senior-level reasoning across several architecture domains.
---

# zeus-deep-analysis

Depth means more verified evidence and more failure paths covered. It does not mean more
prose, a wider scope, or a longer method list.

## Source of truth

`.zeus/ZEUS.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

/deep, LENSSTACK, SECONDORDER, REDTEAM. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

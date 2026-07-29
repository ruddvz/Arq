---
name: zeus-decision-engine
description: Use when choosing among Arq architecture, library, product, renderer, storage, format or delivery options.
---

# zeus-decision-engine

Fix the criteria before looking at the options. Record reversibility with the decision:
a cheap reversible choice deserves less deliberation than a compensable one.

## Source of truth

`.zeus/modules/architecture.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

COMPARE, PROSCONS, RISKMAP, SECONDORDER, DECIDE. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

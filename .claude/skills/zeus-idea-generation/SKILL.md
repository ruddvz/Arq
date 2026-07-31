---
name: zeus-idea-generation
description: Use for generating multiple Arq feature, workflow, UI, architecture or product alternatives before selecting a direction.
---

# zeus-idea-generation

Generate genuinely different approaches, not three variants of one. Converge with
`zeus-decision-engine` rather than by preference.

## Source of truth

`.zeus/method-registry.json`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

ALT3, SCAMPER, IDEAS10. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

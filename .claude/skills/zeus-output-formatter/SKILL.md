---
name: zeus-output-formatter
description: Use last, when an Arq result must become a table, checklist, ordered steps, outline, summary, breakdown or conversion.
---

# zeus-output-formatter

Formatting runs after the work, never instead of it. A well-formatted unverified claim
is still an unverified claim.

## Source of truth

`.zeus/method-registry.json`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

TABLE, CHECKLIST, STEPS, TLDR. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

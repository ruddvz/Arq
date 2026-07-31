---
name: zeus-debugging
description: Use when Arq code, tests, builds, migrations or runtime behaviour fail and the task needs an evidence-backed repair.
---

# zeus-debugging

Reproduce first, then form competing hypotheses, then test the cheapest discriminating
one. A fix without a reproduction is a guess with a diff attached.

## Source of truth

`.zeus/modules/incident.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

HYPOTHESISGEN, DEBUG, /reverse. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

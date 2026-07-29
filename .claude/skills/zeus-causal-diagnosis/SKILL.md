---
name: zeus-causal-diagnosis
description: Use for Arq bugs, regressions, corruption, inconsistent state or performance symptoms where the root cause is not yet proven.
---

# zeus-causal-diagnosis

Separate symptom, mechanism and root cause. Name what evidence would falsify your
current hypothesis, then go get it.

## Source of truth

`.zeus/modules/incident.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

HYPOTHESISGEN, /why, REVERSEENGINEER. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

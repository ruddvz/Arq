---
name: zeus-engineering
description: Use for Arq implementation, refactoring, dependency changes, tests, CI or repository work that must produce a reviewable change.
---

# zeus-engineering

Invariants 72 to 79 govern this work. Smallest complete change, real command evidence,
and Engineering OS 5.0 remains the merge authority.

## Source of truth

`.zeus/INVARIANTS.md` and `.zeus/modules/github-cicd.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

REVERSEENGINEER, DEBUG, /breakdown. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

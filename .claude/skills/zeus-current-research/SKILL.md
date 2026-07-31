---
name: zeus-current-research
description: Use when an Arq decision depends on current browser, library, kernel, standard, format, competitor or security-guidance behaviour.
---

# zeus-current-research

Cite the source and its date. Model recall about a fast-moving API is an assumption, not
evidence: mark it as one until it is checked against the current source.

## Source of truth

`.zeus/INVARIANTS.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

COMPARE, SIGNALVSNOISE. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

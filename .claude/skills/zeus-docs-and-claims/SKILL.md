---
name: zeus-docs-and-claims
description: Use for the Arq public website, help content, release notes, structured documentation, product claims or generated context.
---

# zeus-docs-and-claims

Invariants 80 to 85 govern this work. The Arq Language System 4.1 owns vocabulary,
claims and conflicts. Run `pnpm arq:language:refresh` when a governed source moves.

## Source of truth

`.zeus/INVARIANTS.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

SIGNALVSNOISE, /clarify, /human. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

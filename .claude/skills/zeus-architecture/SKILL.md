---
name: zeus-architecture
description: Use for Arq system boundaries, canonical state ownership, package design, ADRs, major refactors or architecture evaluation.
---

# zeus-architecture

Search for the existing system before proposing a second one. Keep canonical state
semantic and renderer independent, and state second-order effects on persistence, sync,
undo and export rather than assuming them.

## Source of truth

`.zeus/modules/architecture.md` and `.zeus/INVARIANTS.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

SYSTEMMAP, /firstprinciples, SECONDORDER, DECIDE. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

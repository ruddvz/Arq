---
name: zeus-storage
description: Use for Arq project persistence, local replicas, save, autosave, journals, atomic replacement, browser storage or database ownership.
---

# zeus-storage

Local save, journal, working copy, project file, recovery and published state are
distinct tiers. Name the tier that actually changed, in code and in copy.

## Source of truth

`.zeus/modules/arqfs.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

SYSTEMMAP, RISKMAP. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

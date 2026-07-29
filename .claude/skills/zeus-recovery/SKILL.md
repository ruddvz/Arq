---
name: zeus-recovery
description: Use when Arq projects fail to open, save, migrate or sync, or when designing crash and corruption recovery.
---

# zeus-recovery

Recovery prefers preservation over aggressive repair and produces a report. Reproduce on
a copy, prove the cause, then fix. Do not repair a user's only file to test a theory.

## Source of truth

`.zeus/modules/arqfs.md` and `.zeus/modules/incident.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

HYPOTHESISGEN, REVERSEENGINEER, DEBUG. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

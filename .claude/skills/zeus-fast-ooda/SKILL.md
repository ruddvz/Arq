---
name: zeus-fast-ooda
description: Use for a bounded Arq issue where short observe-orient-decide-act cycles are safer than a long speculative plan.
---

# zeus-fast-ooda

Keep each loop small enough to verify. Stop looping when the delivery stop is green or
when two loops produce no new evidence.

## Source of truth

`.zeus/FAST-KERNEL.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

OODA, DELTR. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

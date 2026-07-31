---
name: zeus-adversarial-review
description: Use for pre-mortem, red-team, corruption, hostile input, privacy, security, sync conflict, AI abuse or deliberately blunt critique of Arq work.
---

# zeus-adversarial-review

Attack the design as someone with real capability and real motive. Softening a finding
to be agreeable is the one failure mode this skill exists to prevent.

## Source of truth

`.zeus/INVARIANTS.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

REDTEAM, KILLCRITIC, /reverse, BLACKSWAN. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

---
name: zeus-first-principles
description: Use when Arq architecture is constrained by inherited assumptions, confusing analogies or a request to redesign a foundation.
---

# zeus-first-principles

Rebuild from what the product must be true, not from what the current shape suggests.
Then check the result against the invariant register before proposing it.

## Source of truth

`.zeus/INVARIANTS.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

/firstprinciples, META, HIDDENASSUMPTIONS. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

---
name: zeus-router
description: Use at the start of any substantial Arq request to classify mode, risk, blast radius, delivery stop and the smallest useful module and method stack.
---

# zeus-router

Run `node scripts/zeus.mjs compile --task "<request>"` and work to the contract it returns.
Do not deliver past its delivery stop, and do not load modules it did not route.

If the contract looks wrong, say so and re-run with a corrected task statement rather than
silently working outside it.

## Source of truth

`.zeus/FAST-KERNEL.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.


## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

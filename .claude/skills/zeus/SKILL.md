---
name: zeus
description: Fast adaptive Arq execution system. Classify the request, route the smallest module and method stack, execute to the requested delivery stop and report typed evidence.
---

# zeus

Entry point for the Zeus 5 operating system.

1. Compile the contract: `node scripts/zeus.mjs compile --task "<request>"`.
2. Load `.zeus/FAST-KERNEL.md`, plus only the modules the contract routed.
3. Execute the smallest complete slice to the contract's delivery stop.
4. Run `node scripts/zeus.mjs check --tier <tier>` and record claims with
   `node scripts/zeus.mjs evidence`.
5. Report verified, partially-verified, inferred, assumed, blocked, not-inspected or
   failed. Never report an uninspected claim as green.

## Source of truth

`.zeus/FAST-KERNEL.md` and `.zeus/INVARIANTS.md`. Everything else in `.zeus/` loads on
demand through routing, not by default.

## Commands

`compile`, `route`, `method`, `evidence`, `impact`, `check`, `validate`, `context`,
`index`, `doctor`, `preflight`, `release`, `verify`, `benchmark`, `status`, `ci`,
`deploy`, `smoke`.

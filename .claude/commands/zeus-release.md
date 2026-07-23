---
description: Run release and production delivery
---

Read `.zeus/FAST-KERNEL.md`. Force release mode and the deep tier regardless of how
the task would otherwise classify. Force-load `.zeus/modules/release-production.md`
and `.zeus/modules/github-cicd.md`. Delivery stop is production-verified: current-head
PR/CI checks, guarded merge with expected-head protection, deployment SHA
verification and production smoke are all required evidence, not optional. Route any
additional modules, show the compact contract, then execute:

$ARGUMENTS

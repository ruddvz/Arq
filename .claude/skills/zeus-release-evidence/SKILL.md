---
name: zeus-release-evidence
description: Use for Arq merge, release, deployment, migration rollout, production verification, changelog or public claim readiness.
---

# zeus-release-evidence

Every pass needs a command, an exit code and real output at the current head. Unknown,
blocked and failed are never folded into green.

## Source of truth

`.zeus/modules/release-production.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

CHECKLIST, RISKMAP. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

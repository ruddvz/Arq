---
name: zeus-package-ship
description: Use when the operator asks for a ZIP, implementation package, handoff, patch bundle, manifest or deterministic delivery of Arq work.
---

# zeus-package-ship

Deterministic structure, a manifest, checksums and an integrity check. No placeholder is
presented as verified final content.

## Source of truth

`.zeus/modules/release-production.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

/breakdown, CHECKLIST. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

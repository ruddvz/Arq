---
name: zeus-migration
description: Use for Arq schema or file-version changes, data transforms, compatibility windows or upgrading historical projects.
---

# zeus-migration

Copy-on-write only: preserve the original, migrate a copy, validate, reopen, compare,
then promote. Test interruption, disk full, truncated copy and failed promotion.

## Source of truth

`.zeus/modules/arqfs.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

RISKMAP, /reverse, BLACKSWAN. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

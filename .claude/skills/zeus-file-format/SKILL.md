---
name: zeus-file-format
description: Use for `.arq` structure, schema versions, metadata, resources, checksums, read and write contracts or compatibility policy.
---

# zeus-file-format

Invariants 19 to 26 govern this work. Persistent blast radius: route
`arq-file-integrity-reviewer` and never work on the only original of a file.

## Source of truth

`.zeus/modules/arqfs.md` and `.zeus/INVARIANTS.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

REVERSEENGINEER, RISKMAP. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

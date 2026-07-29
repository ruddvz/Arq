---
name: zeus-semantic-model
description: Use when changing Arq entities, relationships, stable IDs, types, levels, hosts, openings, annotations, issues or representation mappings.
---

# zeus-semantic-model

Invariants 8 to 13 govern this work. Identity is the hard part: type, instance, level,
host, opening, relationship, annotation and issue identities stay distinct, and IDs must
survive the operations the contract names.

## Source of truth

`.zeus/INVARIANTS.md` and `.zeus/modules/architecture.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

SYSTEMMAP, HIDDENASSUMPTIONS. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

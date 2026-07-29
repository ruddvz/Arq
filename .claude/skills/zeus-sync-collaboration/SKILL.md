---
name: zeus-sync-collaboration
description: Use for Arq cloud sync, offline queues, multi-device edits, presence, shared projects, conflicts or revision transport.
---

# zeus-sync-collaboration

Invariants 44 to 50 govern this work. Raw SQLite pages, WAL and SHM are never the sync
contract, and a success indicator means durable state rather than queued work.

## Source of truth

`.zeus/INVARIANTS.md` and `.zeus/modules/arqfs.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

PARADOX, SECONDORDER, REDTEAM. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

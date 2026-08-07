---
source_id: ARQ-OS31-MIGRATION
source_type: migration-guide
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ project administrator
---

# Migration from Operator OS 2.0 and 3.0

## Remove from active Project sources

Remove all Operator OS 1.0, 2.0, and 3.0 source files before installing 3.1. Remove duplicate `(1)` files, old validators, separate schemas, templates, manifests, checksums, and copied repository control-plane files.

Do not keep old and new governance sources active together. Archive prior packages outside the Project when traceability is needed.

## Install 3.1

1. Paste `ARQ_PROJECT_INSTRUCTIONS.txt` into Project Instructions.
2. Upload the 24 numbered Markdown files in the batches listed in source 15.
3. Confirm the Project source count is 24.
4. Confirm no old Operator OS source remains active.
5. Keep the remaining source slot free unless a task genuinely needs a temporary source.

## First read-only validation

Ask the Project:

1. What owns current implementation truth?
2. What owns merge and release authority?
3. What owns public wording and claim conflicts?
4. What is the latest connected snapshot, and when does it expire?
5. Which conflicts are blocking?
6. Does connector admin permission equal consent?
7. What must be proven before a Vercel deployment is called Released?
8. How does a Project task hand off to ZEUS without duplicating repository authority?

Expected answers should cite sources 01, 02, 03, 06, 07, 08, 13, 14, 16, and 17.

## Repository adoption

Use source 22 in a repository-capable coding environment. It is a reconciliation and execution prompt, not an instruction to copy all Project sources into the repository. Search for existing repository systems first. Extend them rather than creating parallel authority.

## Rollback

If 3.1 produces materially worse retrieval, remove its 24 files and restore the archived prior set. Do not change repository state as part of a Project-source rollback.

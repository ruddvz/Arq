---
source_id: ARQ-OS31-README
source_type: setup
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ project owner
---

# ARQ Operator OS 3.1

## Purpose

ARQ Operator OS 3.1 is the ChatGPT Project control plane for ARQ. It manages source authority, cross-system handoff, connected evidence, external research, decisions, and honest reporting. It does not replace the repository's ZEUS, Engineering OS, Language System, ADRs, tests, or release gates.

## Exact Project setup

1. Open ARQ Project settings.
2. Paste `ARQ_PROJECT_INSTRUCTIONS.txt` into Project Instructions. Do not upload that text file as a Project source.
3. Upload the 24 numbered Markdown files `00` through `23`.
4. Upload them in three batches because ChatGPT currently permits only 10 files per upload action.
5. Remove older Operator OS versions and duplicate files such as `(1)` copies from active Project sources.

This edition uses 24 of the 25 Plus Project source slots, leaving one free slot for a temporary task-specific source. The ZIP contains exactly 25 files: 24 Project sources and one instructions file.

## System boundary

When live repository access exists, resolve the repository and immutable HEAD, then read `CLAUDE.md` and `.zeus/FAST-KERNEL.md` before directing code work. Repository authority wins within its scope. Project sources may identify conflicts and prepare handoffs, but must not silently replace accepted repository truth.

## What 3.1 fixes

- Reduces the upload set from 41 package files to 24 active sources.
- Removes separate machine, schema, template, manifest, checksum, test, and tool files from the Project upload set.
- Consolidates those controls into readable, structured sources.
- Keeps Project Instructions under 5,000 characters.
- Leaves one Project file slot free.
- Preserves the 3.0 audit findings, GitHub and Vercel protocols, evidence states, handoff contract, and non-blind implementation prompt.

## Operating status

Completed: source consolidation, instruction revision, filename cleanup, package assembly, count validation, UTF-8 validation, front-matter validation, source-ID uniqueness, and ZIP verification.

Verified: this package contains exactly 25 files, of which exactly 24 are marked as Project sources. The Project Instructions character count is recorded in source 23.

Blocked: this package does not prove that recommended repository, GitHub, Vercel, product, or UI changes have been implemented. No remote write was performed.

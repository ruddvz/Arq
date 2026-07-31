---
name: zeus-assumption-audit
description: Use when an Arq proposal depends on hidden beliefs about files, geometry, browsers, users, sync, AI, performance or compatibility.
---

# zeus-assumption-audit

List each assumption with the evidence state it currently holds. An assumption with no
path to verification is a risk, and belongs in the report rather than in the design.

## Source of truth

`.zeus/INVARIANTS.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

HIDDENASSUMPTIONS, /assumptions. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

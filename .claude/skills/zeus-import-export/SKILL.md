---
name: zeus-import-export
description: Use for Arq IFC, DXF, DWG, SVG, PDF, image or RoomPlan ingestion and production.
---

# zeus-import-export

Invariants 51 to 57 govern this work. Import is untrusted input. Report fidelity with
the canonical vocabulary, and never claim a round trip without a round-trip test.

## Source of truth

`.zeus/modules/interoperability.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

REDTEAM, COMPARE. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

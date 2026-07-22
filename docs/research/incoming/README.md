# Incoming v2.0/v4.0 proposal material - not yet adopted

This directory holds planning material the user uploaded to a working
session (2026-07-22), stored verbatim for reference. **None of it has
been adopted.** The repository's actual current source of truth is
still `docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md`
and the ADRs under `docs/adr/`, unchanged.

## Contents

- `ARQ-BLUEPRINT-v2.0-PROPOSAL.md` - a proposed blueprint revision.
  Despite its own header claiming "Status: Current source of truth,"
  that status has not been ratified in this repository - it conflicts
  with decisions already implemented and shipped here.
- `ARQ-UI-UX-CRITIQUE-v4.0.md` - a UI/UX critique of a marketing/app
  design system that goes well beyond this repository's current
  backlog scope (ARQ-001 through ARQ-191).
- `page-renderings-2.0/` - three of six referenced design-rendering
  boards (marketing site, comments/issues/versions, sync-conflict UI,
  diagnostics dashboard, command palette, onboarding, AI-proposal
  apply flow).

## Known, unresolved conflicts with what is already shipped

`ARQ-BLUEPRINT-v2.0-PROPOSAL.md`'s own "Corrections made in v2.0" list
includes two items that directly reverse work already implemented and
tested in this repository:

1. **"Removed Dexie as the primary project store"** - `@arq/local-storage`
   already adopted Dexie (recorded as "adopt" in
   `open-source/TECHNOLOGY-MATRIX.csv`) as its first local store.
2. **"Locked WebGLRenderer as the Release 1 production path"** - this
   directly contradicts `docs/adr/0008-rendering-strategy.md` (ARQ-118),
   which recommends Canvas 2D as the v1 2D renderer backend, based on
   real, measured benchmark evidence (`docs/research/RENDERER-BENCHMARK-CANVAS-2D.md`,
   `RENDERER-BENCHMARK-PIXIJS-WEBGL.md`, `RENDERER-BENCHMARK-CANVASKIT.md`).

Reverting either decision - re-architecting local storage away from
Dexie, or reversing the renderer ADR - would undo real, tested,
already-shipped work. That is a deliberate, user-facing decision this
session has not been asked to make with enough clarity to act on
irreversibly, so it has not been made. This directory exists so the
material is not lost and is available the moment an explicit decision
is given on how to reconcile it.

# Incoming v2.0/v4.0 proposal material - not yet adopted

This directory holds planning material the user uploaded to a working
session (2026-07-22), stored verbatim for reference. **Most of it has
not been adopted.** The repository's actual current source of truth is
still `docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md`
and the ADRs under `docs/adr/`, unchanged.

## Contents

- `ARQ-BLUEPRINT-v2.0-PROPOSAL.md` - a proposed blueprint revision.
  Despite its own header claiming "Status: Current source of truth,"
  that status has not been ratified in this repository - it conflicts
  with decisions already implemented and shipped here.
- `ARQ-UI-UX-CRITIQUE-v4.0.md` - a UI/UX critique of a marketing/app
  design system that goes well beyond this repository's current
  backlog scope.
- `page-renderings-2.0/` - the complete set of six referenced design-
  rendering boards (marketing site and docs; account/billing, plan/3D/
  sheet/inspect/document/present editor modes; auth and workspace
  flows).

## What was reviewed from the "v4.0 CORE" master pack and its outcome

A later upload (`ARQ-EXECUTION-READY-MASTER-PACK-v4.0-CORE.zip`) was
extracted and reviewed in full. It contains two very different kinds
of material:

1. **`implementation-patches/live-github/`** - concrete, targeted
   patches explicitly prepared for this exact repository and branch
   (`ruddvz/Arq`, `claude/arq-cad-platform-research-ba8rav`), by a
   separate session whose GitHub write access returned HTTP 403. Its
   one patch, `centre-snap/`, was reviewed, adapted (reformatted,
   reconciled against this repo's actual state) and applied: it
   completed ARQ-191's "Centre snap" half (`nearest-snap.ts` already
   covered "Nearest") and split the new candidate contract into
   ARQ-192, both closed on GitHub with evidence.
2. **Everything else** - a much larger, self-contained planning/
   reference archive: an extended static backlog (239 items, mostly
   unfilled templates), a parallel Python reference implementation
   (`reference-implementation/arqfs`), a standalone HTML/JS/CSS
   prototype, a separate `monorepo-starter` scaffold, and business/
   legal/operations documents. None of this targets this repository's
   actual file layout the way the live-github patch does, and adopting
   it wholesale would mean discarding or contradicting 190+ already-
   shipped, tested issues in favour of an unreviewed parallel
   implementation. It has not been merged. `remaining/REMAINING-WORK.md`
   and `remaining/DECISIONS-REQUIRING-EVIDENCE.csv` (inside the pack,
   not copied here) list what the pack's own authors consider still
   undecided.
3. **`ARQLogoEssentialsFINAL.zip`** - already fully present in this
   repository's `brand/` directory (a concurrent PR merged it earlier);
   the zip's contents were diffed file-for-file against `brand/` and
   nothing was missing or different, so nothing further was done.

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

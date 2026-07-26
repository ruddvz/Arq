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

## What was reviewed from the "v4.0 CORE" master pack, in detail, and what was done

A later upload (`ARQ-EXECUTION-READY-MASTER-PACK-v4.0-CORE.zip`) was
extracted and reviewed file-by-file against this repository's actual
state (not just skimmed by directory name). Findings:

1. **Backlog 001-189: identical.** Byte-for-byte diff of every file
   found no differences at all between the pack's `backlog/issues/`
   and this repository's - same plan, same content. This means the
   pack is a genuine continuation of the same planning lineage this
   repository was built from, not a rival/forked plan.
2. **Backlog 190+: both sides independently extended it past 189, with
   different content at the same numbers.** This repository's own
   190-192 (component-doc differentiation, centre/nearest snap, circular
   snap candidate) were discovered and added during real implementation
   work here. The pack's 190-239 are a different, later set (file-system/
   SQLite/Rust-core/sync/performance/security items) discovered by
   whoever built the pack. Both are legitimate; they just collided on
   numbering. **Resolved**: the pack's 190-239 were renumbered +3 (to
   193-242, no cross-references needed adjusting - none of these 50
   files referenced another by number) and copied in, extending this
   repository's ordered backlog to 242 items with no gaps or duplicates.
3. **`implementation-patches/live-github/centre-snap/`** - a concrete,
   targeted patch prepared for this exact repository and branch by a
   separate session whose GitHub write access returned HTTP 403.
   Reviewed, adapted, and applied in an earlier turn: completed ARQ-191's
   "Centre snap" half and split the new candidate contract into ARQ-192,
   both closed on GitHub with evidence.
4. **New reference material adopted as documentation** (not yet
   implemented, not yet decided): ADR-0019 through ADR-0026 (`docs/adr/`),
   14 architecture documents (`docs/architecture/`), the full command
   catalogue and 107 individual command specs (`docs/commands/`), the
   v4.0 brand implementation spec (`docs/brand/`), two new contract files
   (`contracts/arqfs.ts`, `contracts/performance.ts`), a page-renderings
   manifest and v4 brand design tokens (`design/`). These are additive -
   nothing existing was overwritten - and give real, detailed reference
   material for backlog items 193+ as they're reached.
5. **Historical blueprint revisions filed for reference**:
   `blueprint-revisions/` holds the pack's v1.1, v2.0 and v3.0 full
   blueprint documents, its `SOURCE-OF-TRUTH.md`, and its
   `FULL-PLATFORM-FEATURE-CATALOG`. None of these are this repository's
   source of truth (still `ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md`
   and `docs/adr/`, both unchanged).
6. **`ARQLogoEssentialsFINAL.zip`** - already fully present in this
   repository's `brand/` directory (merged via a concurrent PR earlier);
   diffed file-for-file, identical, nothing further done.
7. **Not adopted**: the pack's extended static backlog metadata beyond
   the issue files themselves, its parallel Python reference
   implementation (`reference-implementation/arqfs`), its standalone
   HTML/JS/CSS prototype, and its separate `monorepo-starter` scaffold.
   None of these target this repository's actual file layout, and
   adopting them would mean discarding or duplicating 190+ already-
   shipped, tested issues rather than extending them.

## The SQLite-vs-Dexie conflict: since resolved

An earlier revision of this file flagged one real, hard-to-reverse
conflict: the pack's `SOURCE-OF-TRUTH.md` listed the shipped
Dexie/IndexedDB `@arq/local-storage` package as "superseded" in favour of
a SQLite-WASM + OPFS `.arq` format (ADR-0019/0021/0024), and this file
said that decision "needs the user's explicit go-ahead."

That conflict has since been resolved - do not re-raise it as open. The
resolution is recorded in `docs/product/DECISION-REGISTER.csv`:

- **D-007 (superseded)**: Dexie's role narrowed to the device-local
  derived/index/view-state cache tier only (ADR-0022) - which
  `packages/local-storage/src/derived-cache.ts` already implements. The
  remaining `@arq/local-storage` modules stay in place, real and in use,
  pending a separately-numbered cutover issue once `packages/arqfs` is
  proven; nothing was discarded.
- **D-015 / D-020 / D-023**: the SQLite `.arq` file is the canonical live
  project file (application ID `0x41525131`, versioned schema), run
  through SQLite WASM in a dedicated worker over opfs-sahpool, with the
  zip archive retained as the portable export container.

The direction is no longer paper: `packages/arqfs` (17 test files,
including fuzz, migration, recovery and clean-export coverage),
`workers/arqfs-worker`, and OPFS capability benchmarks under
`benchmarks/results/` all shipped, and `.zeus/FAST-KERNEL.md` makes the
versioned-SQLite `.arq` file a non-negotiable. The user additionally gave
a general go-ahead on 2026-07-26 to settle the flagged decisions.

(The earlier note in this file about a WebGLRenderer conflict was a
misreading: the pack's ADR-0025 is about the _3D_ renderer, Three.js
`WebGLRenderer` vs `WebGPURenderer` - which matches what
`@arq/model-renderer` already uses. It does not conflict with ADR-0008,
which is about the _2D_ renderer.)

The related Tauri desktop-shell question raised by the 2026-07-24 pack is
also now decided: deferred by ADR-0027 / D-024, with explicit revisit
gates. See `docs/adr/0027-desktop-shell-deferral.md`.

## 2026-07-24 upload: "Arq CAD/BIM Architecture Package"

A separate, later upload (`arq_cad_bim_architecture_package.zip`) is filed
in `2026-07-24-cad-bim-architecture-package/` with its own triage README.
It is **not** part of the "v4.0 CORE" lineage above - it's a standalone
"correct the raw blueprint" engineering package (master spec, ultimate
spec, implementation deep dive, UI/UX system spec, 11 ADRs, 17 reference
contracts, a generic Epic-based backlog). Summary: ADR-001 through 006
restate positions this repo already holds under different numbers -
nothing new there. ADR-007 through 011 and most of the `reference/*.ts`
contracts (GPU inspect-through selection, deferred-CSG session, desktop
shell port, HUD/quantity-draft/numeric-scrubber interaction primitives,
float64 render-origin localisation, a rule-pack engine) describe real gaps
not yet built anywhere in this repo - see the subfolder's README for the
file-by-file check and recommended follow-ups. Nothing from it has been
applied to `packages/` or `docs/adr/`.

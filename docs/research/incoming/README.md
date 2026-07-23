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

## The one real, unresolved architectural conflict

The pack's own `docs/product/SOURCE-OF-TRUTH.md` (filed in
`blueprint-revisions/`) explicitly states its current source includes
"ADR-0019 and later" and lists **"Dexie project database"** and
**"generic IndexedDB ADR-0006"** under "Historical or superseded."
ADR-0019/0021/0024 (now in `docs/adr/`) propose a SQLite-WASM +
OPFS-backed `.arq` file format instead, and ADR-0020 proposes a shared
Rust core compiled to WebAssembly.

This is a real, deliberate, hard-to-reverse conflict with what is
already shipped and tested here: `@arq/local-storage` is a working,
tested Dexie/IndexedDB implementation (`database.ts`, `journal-append.ts`,
`journal-recovery.ts`, `snapshot.ts`, `archive-export.ts`, `quota-error.ts`,
`recovery-report.ts`). Adopting the pack's direction would mean rewriting
or discarding that package, and adding an entirely new Rust/WASM
toolchain to the monorepo's build. (The earlier note in this file about
a WebGLRenderer conflict was a misreading: the pack's ADR-0025 is about
the *3D* renderer, Three.js `WebGLRenderer` vs `WebGPURenderer` - which
matches what `@arq/model-renderer` already uses. It does not conflict
with ADR-0008, which is about the *2D* renderer.)

This decision has not been made unilaterally - it needs the user's
explicit go-ahead, since it discards real, tested work and adds a new
toolchain dependency.

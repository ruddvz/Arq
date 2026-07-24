# 2026-07-24 upload: "Arq CAD/BIM Architecture Package" — triage notes

**Status: not yet adopted.** This directory holds a zip the user uploaded to a
working session on 2026-07-24, stored verbatim (`SOURCE-README.md` is the
pack's own index; it is the file `README.md` inside the original zip,
renamed here only to not collide with this triage file). The repository's
actual source of truth is unchanged: `docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md`,
`docs/adr/` (0001-0026), and the shipped code under `packages/`.

This is a different pack from the one already triaged in the parent
`docs/research/incoming/README.md` (the "v4.0 CORE" master pack reviewed
2026-07-22, whose backlog 001-189 was byte-identical to this repo's own
lineage). This 2026-07-24 pack is **not** part of that lineage — it reads as
an earlier-stage, standalone "correct the raw blueprint" exercise:

- Its `IMPLEMENTATION_BACKLOG.md` uses a generic Epic-0-through-10 narrative
  structure, not this repo's numbered `ARQ-001..242` issue-per-file backlog.
  No file-for-file match is possible or meaningful here; do not merge it
  into `backlog/issues/`.
- Its `decision_records/ADR-001..011` use their own numbering and don't
  reference this repo's actual package names (`@arq/model-context`,
  `@arq/input-system`, etc.) — it's product-agnostic engineering guidance,
  not a patch written against this codebase.

## What's already covered by accepted, shipped decisions

ADR-001 through ADR-006 restate positions this repository already holds and
has implemented, just under different numbers/wording:

| Pack ADR | Already covered by |
| --- | --- |
| ADR-001 semantic source of truth | `docs/adr/0002-plan-first-semantic-model.md`, `@arq/model-context` |
| ADR-002 single authoritative model worker | `docs/architecture/SYSTEM-OVERVIEW.md`, `@arq/model-context` |
| ADR-003 derivation DAG ≠ constraints | `docs/architecture/DERIVED-DATA-GRAPH.md` |
| ADR-004 interchange capability boundary | `docs/adr/0011-ifc-adapter.md`, `0012-dxf-and-dwg-strategy.md`, `@arq/ifc-adapter`, `@arq/dxf-adapter` |
| ADR-005 semantic-operation collaboration | `docs/adr/0013-collaboration-staging.md`, `docs/adr/0021-local-first-replica-sync.md`, `@arq/collaboration`, `@arq/sync-protocol` |
| ADR-006 jurisdictional rule packs | not yet built as a dedicated package, but consistent with existing non-goals (no hard-coded global code values anywhere in the repo) |

No conflict found in this group — it's confirmatory, not new information.

## What's genuinely new (not yet implemented anywhere in this repo)

Checked: no file named after any of the 17 `reference/*.ts`/`.wgsl`
contracts exists anywhere in the repo (`find` for `picking-contract`,
`hud-placement`, `quantity-draft`, `numeric-scrubber`, `command-palette-state`,
`diagnostic-actions`, `deferred-csg-session`, `webgpu-render-origin`,
`dependency-graph`, `snap-engine`, `semantic-operations`, `rule-engine`,
`worker-protocol`, `coordinates.ts`, `native-desktop-port` all returned
nothing). Confirmed against current implementation state:

- **GPU selection / inspect-through (ADR-007, `picking-contract.ts`,
  `selection-id-pass.wgsl`)** — `packages/model-renderer/src` currently has
  only `model-camera`, `model-scene`, `orbit-camera`, `shared-selection`. No
  draw-ID table, no depth-peel pass, no readback ring buffer exist yet. This
  is real, not-yet-reached future work, not a correction to shipped code.
- **Desktop shell boundary (ADR-008, `native-desktop-port.ts`)** — no Tauri
  integration exists in the repo yet (`docs/adr/0015-native-ipad-strategy.md`
  covers iPad, not a Tauri desktop shell). Net-new.
- **Non-modal deferred CSG (ADR-009, `deferred-csg-session.ts`)** —
  `packages/geometry-3d` has `extrude-polygon-mesh` and
  `wall-opening-meshes` but no staged preview/commit/stale-result state
  machine. Net-new.
- **Unified contextual interaction boundary (ADR-010)** — partially true
  already: `packages/design-system/src/shell/command-palette.tsx` +
  `command-palette-search.ts` (built for ARQ-029) already implement most of
  what `reference/command-palette-state.ts` asks for — subsequence fuzzy
  search, `aria-activedescendant` combobox pattern, disabled-reason as
  visible text (not colour-only), Escape-to-close, 44px touch targets. What
  is **not** yet present: a contextual HUD component, a quantity-draft
  input (`quantity-draft.ts`'s draft/commit/cancel split), or a numeric
  scrubber (`numeric-scrubber.ts`'s pointer-capture session). `grep` for
  "quantity draft", "NumericScrub", "hud-placement" across `packages/`
  returned no hits outside the palette files.
- **Progressive surface/motion system (ADR-011, `arq-ui-theme.css`)** — no
  matching design token file found under `packages/design-system`; worth a
  side-by-side compare against that package's existing token source before
  any adoption, since the two may already diverge in naming.
- **Render-origin localisation (`webgpu-render-origin.ts`,
  `high-low-render-origin.wgsl`, `coordinates.ts`)** — `packages/model-renderer`
  has no float64→float32 chunk-origin localisation step yet (`grep` for
  `float64`/`localOrigin`/`renderOrigin` in its `src/` returned nothing).
  Consistent with the repo still being 2D-plan-first per ADR-0001/0002; this
  becomes relevant once 3D/site-scale work is reached.
- **Rule engine (`rule-engine.ts`)** — no rule-pack package exists yet.
- **Snap engine (`snap-engine.ts`) / dependency graph
  (`dependency-graph.ts`) / semantic operations (`semantic-operations.ts`)
  / worker protocol (`worker-protocol.ts`)** — the repo has working
  equivalents already shipped in `@arq/geometry-2d`, `@arq/operations`,
  `@arq/collaboration`, and `@arq/model-context`. These pack files are
  useful as an independent second opinion / test-fixture source if a gap is
  ever found, but are not a gap-fill on their own — no line-by-line diff was
  done given the shipped code already has its own tests and backlog
  provenance (ARQ-### commits), and this pack's versions don't reference
  this repo's actual types.

## Recommendation

Nothing here should be applied directly to `packages/` or `docs/adr/`
without a specific backlog item and the user's go-ahead, per this
repository's own non-negotiable ("Live implementation and accepted ADRs
outrank old packs and screenshots" — `.zeus/FAST-KERNEL.md`) and per the
precedent set by the 2026-07-22 pack triage. The concrete, actionable
follow-ups are:

1. When a backlog item reaches contextual HUD / quantity-draft / numeric
   scrubber work, use `reference/hud-placement.ts`, `reference/quantity-draft.ts`,
   and `reference/numeric-scrubber.ts` as a starting contract — they're
   compatible with (not a rewrite of) the existing command-palette work.
2. When 3D/GPU selection work is scheduled, ADR-007 plus
   `picking-contract.ts` and `selection-id-pass.wgsl` describe a capped,
   revision-matched depth-peel design worth evaluating against whatever
   `packages/model-renderer` looks like at that time.
3. A Tauri desktop shell (ADR-008) is a hard-to-reverse platform decision —
   raise it with the user explicitly before starting, same as the
   SQLite-WASM-vs-Dexie conflict already flagged in the parent
   `docs/research/incoming/README.md`.
4. `arq-ui-theme.css` should be diffed against
   `packages/design-system`'s actual token source before reuse, since no
   automated comparison was done here.

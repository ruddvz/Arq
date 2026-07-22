# PROJ-023: Onboarding project

**Route or surface:** `/app/onboarding`
**Access:** signed-in
**Status:** Planned

## Goal

Teach the benchmark workflow inside a real project.

## Entry points

- Project dashboard (recent, shared, templates)
- Deep link, validated against the user's workspace role before rendering
- Mode switch within an already-open project (Design/Document/Inspect/Review/Present)
- Command palette

Surfaces whose route in `docs/pages/ROUTE-MAP.csv` is `overlay` or `panel` (command
palette, keyboard shortcuts, model health, AI proposal) are entered from within an
already-open project page, not navigated to directly, and are dismissed back to it.

## Required regions

- Canvas or primary content (plan, 3D, sheet, or list, depending on the page)
- Tool rail and context bar where the page includes authoring tools
- Inspector or property panel where the page supports selection
- Status bar (units, snap, selection, save/sync state)
- Help or documentation path

## Required states

- Default
- Empty (new or blank project/view)
- Loading (large project - see `benchmarks/PERFORMANCE-BUDGETS.json`)
- Invalid / blocked by validation (see `docs/adr/0005-typed-operations.md`)
- Permission denied (per `security/RBAC-MATRIX.csv` for this page's required role)
- Offline (must remain usable - this is a local-first surface, not a degraded one)
- Partial failure (for example, a partially completed import)
- Sync conflict (where the page can encounter one)
- Completed / committed

## Behaviour

- Local project state is preserved when network access fails - never lost, never
  silently discarded.
- No operation mutates the project without an explicit, previewable action; nothing
  is deleted to make a request "succeed" (see `docs/ai/AI-GUARDRAILS.md` for the AI
  case specifically).
- Disabled tools explain why (role, plan entitlement, validation state, or offline),
  matching `security/RBAC-MATRIX.csv` for this page's required role.
- Every canvas action has a non-canvas equivalent reachable from the tree, inspector,
  or command palette.

## Responsive behaviour

- Desktop uses the complete panel layout.
- iPad landscape preserves the canvas/primary content with panels visible.
- Portrait collapses secondary panels to drawers or sheets.
- Unlike public pages, canvas-bearing surfaces are desktop/tablet-class tools and are
  not expected to be usable at 320 CSS pixels - that constraint applies to public
  pages, not here.
- Browser zoom to 200 percent preserves the primary action without breaking the
  panel layout (see BUG-RISK "Browser zoom breaks panel layout").

## Keyboard and accessibility

- Logical tab order and visible focus; overlays trap focus and return it to their
  trigger on every close path (see BUG-RISK-140 and the fix already verified in
  `prototype/app.js`).
- One page heading and appropriate landmarks (overlay/panel surfaces use their host
  page's landmark).
- Escape closes the current temporary layer only, one level at a time.
- Status is not communicated by colour alone (see the "active tool" fix in
  `prototype/index.html` for the pattern - `aria-pressed`, not colour alone).
- Errors are associated with the affected field and the affected model object.
- Canvas functionality has tree, inspector, and command-palette alternatives.

## Analytics

Record page viewed, primary action result, a stable failure code, and coarse latency.
Never record project geometry, names, addresses, or raw prompts (see
`analytics/EVENT-DICTIONARY.csv`).

## Acceptance criteria

- [ ] All required states have designs.
- [ ] Permission and offline behaviour are defined and match `security/RBAC-MATRIX.csv`.
- [ ] Keyboard and iPad behaviour are tested.
- [ ] Empty, loading, invalid, and failure states exist.
- [ ] Copy follows the product-copy principles.
- [ ] No unsupported product claim appears.

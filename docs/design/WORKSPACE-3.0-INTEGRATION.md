# Workspace integration status (UI/UX Package 3.0 / 4.0)

What Package 3.0/4.0 specifies, what this repository actually implements, and
where each half lives. Everything below is either produced by
`pnpm check:workspace-registries` or checked by a test; nothing is a
hand-maintained tally.

Package 3.0's premise is that the open-project workspace — not the marketing,
auth or account pages — is the primary product. Package 4.0 keeps the whole of
3.0 and adds a workspace visual-refinement layer on top. This integration takes
the machine-readable half of both and makes it the implementation contract.

## Where the package lives in this repository

| Package artefact                 | Repository location                      |
| -------------------------------- | ---------------------------------------- |
| 13 `workspace-*.json` registries | `packages/workspace/src/registry/`       |
| Workspace state and contracts    | `packages/workspace/src/`                |
| Shell components                 | `packages/design-system/src/workspace/`  |
| Host wiring                      | `apps/web/src/App.tsx`                   |
| Integrity + coverage gate        | `scripts/check-workspace-registries.mjs` |

The registries are checked in verbatim (re-indented only). They are the source
of truth: `packages/workspace/src/registry.ts` reads them, and
`registry.test.ts` fails the build if the code and the JSON disagree.

Per the package's own `docs/18_REPOSITORY_INTEGRATION_MAP.md`, the specification
prose is **not** mirrored into this repository — it stays in the package. This
file is the repository's side of that contract.

## Coverage

Run `pnpm check:workspace-registries` for current numbers. At the time of
writing:

|                      | Designed by the package | Built here |
| -------------------- | ----------------------- | ---------- |
| Tool commands        | 54                      | 11         |
| Icon glyphs          | 215                     | 40         |
| Workspace components | 147                     | 14         |
| Workspace surfaces   | 30                      | see below  |

These gaps are the expected state and the check never fails on them. A
specification package that runs ahead of the product is doing its job; a gate
that failed on the gap would only create pressure to shrink the specification or
overstate the build.

### Tools

`workspace-tool-registry.json` marks 20 of its 54 tools `existing-or-partial`,
and its own `important` field says that status "is a design/implementation
coverage marker, not a shipping claim". This repository backs **11**, each named
against its implementing module in
`TOOLS_WITH_REPOSITORY_BACKING` (`packages/workspace/src/tool-state.ts`):

`select`, `window-select`, `crossing-select`, `selection-filter`, `wall`,
`door`, `window`, `room-boundary`, `pan`, `zoom`, `fit`.

The other 43 appear in the tool rail **disabled, with the reason "… is designed
but not built yet"**. They are not hidden — doc 38 wants the shape of the
product visible — and they are not clickable.

`dimension` is the instructive case: the shell has had a Dimension button and
@arq/icons ships `dimension.svg`, but no dimension tool module exists. An icon
and a rail slot are not an implementation, and `tool-state.test.ts` asserts that
this repository does not claim it.

### Icons

The 40 glyphs in `design/icons/svg/` are exactly the 40 the icon registry marks
`source: existing-repo`. The remaining 175 are specified but undrawn.

Package 3.0 is explicit that generated placeholder vectors are not ARQ artwork,
so nothing here fabricates them. Tools with no glyph render as a text label —
legible and honest — and the registry check enforces the 24×24 / 1.75px
geometry rules on every entry so a future glyph cannot be added off-spec.

### Surfaces

Of the 30 workspace surfaces, this integration implements the shell that hosts
them plus one surface:

- **WS-01 Project overview** — `ProjectOverviewSurface`, data-gated per doc 35.
- **WS-02 Design / plan** — the existing `PlanCanvas`, now inside the workspace
  shell rather than a flat page.
- **WS-26 Command palette** — pre-existing, now reachable via the registry's
  `⌘K` / `Ctrl+K` binding with the IME and text-field rules applied.

The remaining 27 are specified and registry-backed but not built. Several are
capability-gated regardless (see below).

### Components

Fourteen of the 147 workspace components exist as code:

- **Shell** — `WorkspaceRoot`, `ModeRail`, `ProjectTabStrip`, `PanelResizeHandle`,
  `TabContextMenu`.
- **Panels** — `ProjectBrowserPanel` (doc 39's four sections),
  `InspectorPanel` (doc 40's five tabs), `ProjectOverviewSurface`.
- **Touch** — `WorkspaceSheet`, `PhoneDock`, `PhoneProjectBar`,
  `TabletDrawerBar`, `CompactViewControl`, `ViewSwitcherList`.

The rest of the shell
is served by converging the repository's **existing** components rather than
duplicating them — Package 3.0's execution prompt §0 is explicit that it
"extends/converges those contracts; it is not permission to delete them and
rebuild from screenshots":

| Package 3.0 component | Served by                     |
| --------------------- | ----------------------------- |
| `GlobalProjectBar`    | existing `TopBar`             |
| `PrimaryToolRail`     | existing `ToolRail`, extended |
| `ProjectBrowserPanel` | existing `ModelPanel`         |
| `InspectorPanel`      | existing `InspectorShell`     |
| `ContextActionBar`    | existing `ContextBar`         |
| `WorkspaceStatusBar`  | existing `StatusBar`          |

Two extensions were made to `ToolRail` rather than forking a second rail:

1. **An eighth category, `review`.** The registry has eight tool groups; the
   blueprint named seven. Review is _appended_, so blueprint section 12's fixed
   order holds for all seven it named and no existing category changes index.
2. **`disabledReason` per tool.** Execution prompt §3: every control must be
   able to explain itself. The reason goes into the accessible name, not only a
   `title`, because a tooltip is unreachable by keyboard and by touch.

## Capability gates

`workspace-capability-gates.json` has seven gates.
`DEFAULT_WORKSPACE_CAPABILITIES` enables exactly one — `CAP-core-plan`, the 2D
authoring path this repository has actually built and tested.

`CAP-3d`, `CAP-document` and `CAP-broad-exchange` are **off** despite
near-term registry statuses and despite prototype adapters existing in this
monorepo. A prototype existing is not the workspace being allowed to present it
as a capability, and execution prompt §6 is explicit that demo evidence is not a
shipping claim. `CAP-collaboration`, `CAP-ai` and `CAP-native` are off for the
same reason plus the absence of any backing system.

Turning a gate on is a deliberate act by the host application once the backing
system exists.

## Invariants this integration enforces in code

`workspace-state-machines.json` ships four invariants. Three of them are
structural facts about this code, not review conventions:

1. **"Local save and remote sync are separate machines."** `SaveSyncState` is
   two disjoint unions in two fields. There is no combined status enum to
   collapse them into.
2. **"View/tab close never deletes model data by implication."** `closeTab`
   returns a new `ViewTabsState` and nothing else — no callback, no deletion
   channel. `view-tabs-state.test.ts` proves a duplicated view survives its
   sibling tab closing.
3. **"Tool preview never becomes canonical until transaction commit."** Preview
   is a phase in the tool machine and carries no document revision.

The fourth — "stale asynchronous results never overwrite newer document
revision" — is **not** enforced here. `@arq/workspace` holds no async work, so
there is nothing in this package for a stale result to overwrite. It remains an
obligation on the packages that do load and mutate documents.

Doc 33's structural rule, "no layer duplicates canonical model state", is held
by `@arq/workspace` having no dependency on `@arq/bim-core` or
`@arq/operations`. It cannot reach the model, so it cannot mirror it.

## Responsive behaviour

Layout selection reads width and pointer capability only — never a user-agent
string. `panelDockingPolicy` decides how many columns a band may have _before_
the canvas floor decides how wide they may be, because the touch layouts declare
no floor at all. Doc 46's "never shrink desktop three-column UI onto a phone"
and iPad portrait's "No left+right desktop columns" are enforced by
`WorkspaceRoot` rendering a _different composition_ on every `'drawers-only'`
band — phone and both tablet bands — rather than a narrower one.

Doc 36's canvas floor ("canvas should not fall below 620px on a 1536 layout;
before that happens, turn the Inspector into an overlay") is computed from real
widths rather than breakpoints, so a user who has dragged the browser panel to
its 384px maximum hits the floor at a wider viewport than one who left it at
268px. On the docking bands panels **float**, never close: closing would discard
a preference the user set explicitly and make window resizing destructive.

### Verified

Measured in a headless Chromium against the production build, at the eight
viewports `workspace-qa-fixtures.json` lists:

| Viewport    | Band             | Canvas | Docked panels |
| ----------- | ---------------- | -----: | ------------- |
| 1920 × 1080 | desktop          |   1022 | 2             |
| 1536 × 864  | desktop          |    638 | 2             |
| 1366 × 768  | desktop          |    760 | 1 (+1 float)  |
| 1024 × 768  | compact-desktop  |    418 | 1 (+1 float)  |
| 1194 × 834  | tablet-landscape |   1178 | 0             |
| 834 × 1194  | tablet-portrait  |    818 | 0             |
| 393 × 852   | phone            |    377 | 0             |
| 412 × 915   | phone            |    396 | 0             |

No console errors and no horizontal document overflow at any of them. The 1920
and 1536 canvases clear their registry floors (900 and 620).

### Divergences from the registry, and why

- **Tool rail width.** `workspace-layout-slots.json` allows 48px for an
  icon-only tool rail; this repository's `ToolRail` is 200px because its
  categories are labelled by text (`design/icons/svg/` has no category glyphs,
  and blueprint section 174 warns an invented glyph is worse than a clear word).
  The mode rail is 112px for the same reason. The canvas-floor calculation is
  told the **rendered** 312px via `railsWidthPx` — feeding it the registry's
  96px left the floor ~150px optimistic, so it stayed silent while the real
  canvas was already under its minimum.
- **44px targets vs 40px strips.** shell-controls.css enforces a 44px minimum in
  both axes, correct and non-negotiable for touch; doc 36 also specifies a 40px
  tab strip and 38px context bar. Both numbers are right for their own input, so
  `workspace-shell.css` relaxes to doc 36's 36–40px desktop hitbox under
  `(pointer: fine)` only. A coarse pointer keeps the full 44px and a slightly
  taller strip.

## Responsive and touch behaviour

- **Doc 36's collapse priority is implemented, not approximated.**
  `planTopBarLayout` measures the rendered controls and folds the
  lowest-priority ones into an overflow menu in the order doc 36 states —
  presence, then low-priority status text, then secondary collaboration
  actions — while project identity and active view are structurally protected
  and never collapse. Measured rather than guessed from breakpoints, because
  every guess here has been wrong: this bar previously wrapped to three rows and
  173px at phone width.
- **A band closing a panel is not mistaken for the user closing it.**
  `PanelState.dockedPreferenceOpen` records what the user last chose on a
  docking band, so dragging a window narrow enough to cross the tablet band and
  back restores the panels — while a panel the user closed deliberately stays
  closed.
- **Sheet detents have both a button and a drag.** The button is the contract,
  because a drag-only sheet is unreachable by keyboard, switch device or voice
  control; `detentForDraggedHeight` adds doc 47's gesture on top, snapping to the
  nearest registry detent so an overshoot lands where the sheet visibly is.
- **The tree is virtualised** (doc 39): a collapsed branch costs one row, and the
  window renders ~30 rows of a 5,000-element level while `aria-setsize` reports
  the real total. The focused row is always kept mounted — unmounting it drops
  focus to `<body>` and silently ejects a keyboard user from the tree.

## Accessibility

Enforced, and several decisions were made because of it:

- **One Tab stop per tablist.** The view-tab strip, browser sections and
  inspector tabs are all roving-tabindex tablists. The tab close control is
  deliberately _outside_ the Tab order — every closeable tab used to add a second
  stop, so ten views cost twenty Tab presses. Closing stays reachable four other
  ways (Delete on the focused tab, the context menu via Shift+F10 or the Menu
  key, Cmd/Ctrl+W, and the palette's "Close active view"), and the tab's
  accessible name announces the Delete path so it is discoverable.
- **Skip link** to the canvas, because a keyboard user otherwise crosses more
  than twenty controls to reach the drawing.
- **`aria-modal` is never claimed without `inert`.** The bottom sheet is modal
  only at its `full` detent, where it genuinely covers the canvas; the shell
  behind it is then `inert`, which both makes the claim true for a screen reader
  and removes the need for a hand-rolled focus trap. At `peek` and `half` the
  canvas stays usable and nothing claims modality. The landscape tablet drawer is
  a dismissable `dialog` and deliberately not modal — the canvas beside it is the
  point.
- **Menus move focus in and restore it out.** Every disabled control puts its
  reason in the accessible name rather than only a `title`, since a tooltip is
  unreachable by keyboard and by touch.
- The 44px touch minimum holds on coarse pointers; it relaxes to doc 36's
  36–40px desktop hitbox under `(pointer: fine)` only.
- **Every gesture has a keyboard equivalent.** Tab reorder is Ctrl/Cmd+Shift+
  Arrow as well as a pointer drag — and a bare Arrow still navigates, so a
  reorder cannot happen by accident. Panel resize is Arrow/Home/End as well as a
  drag. Sheet detents are a button as well as a drag. Tab close is Delete, the
  context menu, Cmd/Ctrl+W and the palette.

## Known gaps

Everything below is _specification without an implementation path in this
build_ — not shell behaviour left half-finished. Each one needs a system that
does not exist yet, and building the UI for it would mean inventing the data.

- **27 of 30 surfaces, 43 of 54 tools, 175 of 215 icons and 133 of 147
  components are specified only.** The tools appear in the rail, disabled, with
  the reason; the icons are not drawn because a generated placeholder is not ARQ
  artwork.
- **The browser's Documents and Files sections, and the inspector's Type,
  Relations, Warnings and History tabs, render honest empty states.** Nothing in
  this build produces sheets, references, relations, diagnostics or revisions, so
  each says what would be there rather than showing a fabricated list.
- **Split view.** `workspace-tab-registry.json` marks several kinds
  `supportsSplit`, but there is no split viewport host, so the context menu omits
  Split right and Split down entirely rather than offering a disabled control for
  a capability that does not exist.
- **Doc 39's full row anatomy** — disclosure chevron, per-row visibility and lock
  actions, inline rename, the row More menu. The tree flattens with every branch
  expanded; the virtualiser is correct either way, but the controls are unbuilt.
- **The Package 4.0 visual-refinement layer** (docs 55–58 and the seven boards)
  is a target for the shell's appearance. This integration delivers the structure
  those boards describe, not their finish.

## Verification

`pnpm benchmark:workspace-layout` drives the production bundle in headless
Chromium at all eight `workspace-qa-fixtures.json` viewports and asserts band
resolution, the registry canvas floor, absence of horizontal overflow, that
touch bands are canvas-first _and_ offer a control to summon panels back, and
that save and sync stay separately legible. It runs in CI beside the existing
browser capability checks.

That check is not decoration — it caught `PhoneProjectBar` hardcoding
"Unsaved changes · Offline" for a project that was never open while the desktop
bar honestly said "No project open". Three earlier defects were found the same
way and could not have been caught otherwise: the app never imported
`shell-controls.css` so the shell rendered unstyled; the canvas floor used the
registry's 48px tool rail while the rendered rail is 200px; and the tablet bands
rendered two docked columns, reducing an 834px iPad to a zero-width canvas. All
three passed typecheck and the full unit suite.

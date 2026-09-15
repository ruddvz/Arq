# ARQ UI/UX selection and focus authority map

- Issue: #401
- Programme: #377
- Phase: UX-0
- Integration authority: `main`
- Revalidated integration head: `c57f8353a0adf9130a33c1c23b8fffdefa5c5bf0`
- Evidence branch: `codex/arq-401-selection-authority-evidence`
- Runtime mutation scope: none

This audit maps the current authority for semantic selection, DOM focus, hover,
active tools, active level/view and inspector targeting across Plan, 3D, the
model tree and the inspector. It does not redesign selection and does not solve
#425.

## Integration and ownership authority

`main` is the live integration branch for the active ARQ programme. The
repository default-branch pointer still names the older
`claude/arq-cad-platform-research-ba8rav` branch; #332 tracks that
administrative mismatch.

At the revalidated head:

- PR #361 remains open and owns `apps/web/src/App.tsx` plus native
  session/persistence paths.
- #401 therefore keeps `App.tsx` read-only and changes no selection runtime.
- the `4184551 -> a02ccc` drift added #398 evidence only.
- the `a02ccc -> c57f835` drift closed #412 by adding shell/design-system overlay
  zones and layer ownership. It did not change App selection wiring,
  `PlanCanvas`, `ModelCanvas`, model-tree selection, inspector targeting,
  `WorkspaceModeState.selection`, active-level selection clearing or view-tab
  selection continuity.

Required issue #319 could not be resolved from the live repository. This audit
does not invent a contract for it.

## State domains

The current implementation has five distinct state domains. They must not be
collapsed accidentally.

### A. Semantic selection/session state

The effective live authority is App-level `modelSelection`:

```ts
const [modelSelection, setModelSelection] = useState<ModelPanelSelectionState>({
  primary: null,
  secondary: new Set(),
});
```

It is session/presentation state containing semantic element IDs. It is not
canonical building data.

### B. DOM keyboard focus

Focus belongs to normal browser/component focus handling for tree rows, search,
inspector inputs, shell controls and overlays. Moving DOM focus does not write
semantic selection.

### C. Hover and transient pointer state

`PlanCanvas` owns local hover and marquee state. Hover is transient. Marquee is
transient until pointer-up emits a semantic selection result.

### D. Active tool state

Select, Wall, Pan, Fit and tool cancellation use workspace/App tool state. Tool
state is separate from semantic selection.

### E. Canonical project data

Project/model data remains owned by the semantic/project operation domain.
Selection only references canonical data through semantic IDs.

Allowed direction:

`session selection -> semantic IDs -> read canonical project state`

Selection must never become persisted `.arq` project truth.

## Authoritative selection owner

The effective cross-surface authority is App-level `modelSelection` in
`apps/web/src/App.tsx`.

The traced live path is:

- Plan reads `modelSelection` and writes through `onSelectElement` and
  `onSelectMany`.
- 3D reads the same object and writes through `onSelectElement` after mapping a
  renderer hit back to semantic `elementId`.
- The model tree reads the same object and writes through `onSelectNode`.
- The inspector owns no selected ID. App derives its target/properties from
  `modelSelection` plus current project/wall projection data.
- Selection-aware context actions read the same selection.

No renderer, tree component or inspector component was found owning another
live semantic-selection source on the traced path.

## Current write semantics

Current deterministic rules are:

- no selection: `primary = null`, secondary set empty;
- single Plan/tree/3D selection: one primary, secondaries cleared;
- Plan marquee: first returned ID becomes primary, remaining IDs become
  secondary;
- tree click: clicked semantic node becomes the sole primary;
- 3D click: hit semantic element becomes the sole primary;
- an empty 3D point-selection result clears semantic selection;
- selected drawn-wall deletion clears selection after the operation;
- active native-level switch clears selection;
- project close/reset clears selection;
- Plan/3D view switching does not rewrite selection.

## Plan state

`PlanCanvas` receives semantic selection as a prop. It does not own a semantic
selection store.

Its local state remains deliberately separate:

- `hoveredId` is pointer hover only;
- marquee state exists only during drag until it emits `onSelectMany`;
- wall-draft state belongs to the Wall tool;
- marquee Escape is handled by marquee interaction;
- wall-draft Escape is handled by the Wall tool.

The plan renderer consumes semantic selection only for visual treatment and
handles.

## 3D state

`ModelCanvas` receives the same semantic selection object as Plan.

Raycast hits use rendered mesh metadata to recover semantic `elementId`.
Renderer mesh identity is projection detail, not canonical selection identity.
Multiple rendered solids may represent one selected semantic object.

3D currently replaces selection with a single primary. It does not provide the
same multi-selection input behaviour as Plan. An empty 3D hit emits the current
null-selection clear path.

## Tree state and focus

The model tree receives `modelSelection` plus a selection callback. Tree rows
use selection for `aria-selected` and primary presentation.

The tree virtualiser can keep the primary selected row mounted outside the
normal viewport. That is a presentation optimisation, not another selection
writer.

DOM focus remains normal browser focus on row buttons and search controls. A
semantic selection can remain unchanged while keyboard focus moves elsewhere.

## Inspector targeting

The inspector does not own an independent selected-element ID.

App derives selected current-level wall records from `modelSelection` and
current wall/project state, then builds inspector groups and the selected object
description.

Current limitation: a semantic selection that is not represented in the
current wall projection can remain selected in the tree while the rich wall
inspector has no equivalent target. #391 remains the broader project-browser
and inspector owner.

## Invalid and deleted targets

For drawn walls, explicit delete removes selected walls in one operation and
then clears semantic selection.

App also reconciles disappearing `drawn-wall-*` IDs after undo/redo or similar
changes. Dangling IDs are removed; if a primary disappears while a secondary
survives, a surviving secondary can be promoted.

That reconciliation is not a general canonical-project invalidation contract.
#389 owns broader semantic model/invalidation coordination and #425 must define
how unified session selection handles invalid canonical IDs.

## Active level, hidden and off-level targets

`handleShowLevel(levelId)` replaces the active level projection and clears
`modelSelection`. Current level switching therefore has a deterministic
clear-selection policy.

A hidden tree node can remain semantically selected. Hidden state is
presentation metadata, not another selection source.

The project tree can contain objects from the whole project while Plan, 3D and
current wall inspector projection are level-scoped. Selecting an off-level tree
object can therefore create a valid semantic tree selection that has no current
Plan/3D/rich-inspector projection. A later level switch clears it.

That behaviour is deterministic but incomplete. #425 must define the desired
hidden/off-level selection policy rather than #401 redesigning it.

## Plan and 3D view switching

Active view is tab state, not selection state. Switching Plan -> 3D -> Plan does
not rewrite `modelSelection`, so semantic selection continuity is preserved.

Workspace mode changes update `modeState.mode` and `previousMode`; they do not
replace App-level semantic selection.

## Escape and clear-selection ordering

There is no current global rule that Escape clears semantic selection.

Shell Escape handling closes an overlay or cancels the active tool. Plan has
more specific Escape handling for marquee and wall draft. Semantic selection
is not cleared merely because Escape was pressed.

The browser probe verifies the current ordering:

1. select a semantic target;
2. move DOM focus to a shell control and press Escape;
3. semantic selection remains unchanged;
4. switch to 3D and click a measured empty point clear of the floating browser
   panel;
5. the null 3D point-selection result clears shared semantic selection.

If #425 later introduces a central Escape-to-clear command, it must define its
ordering after overlays/tools instead of treating it as an existing contract.

## Dormant duplicate representation

`packages/workspace/src/mode-state.ts` also defines
`WorkspaceModeState.selection` with `primaryId` and `secondaryIds`.

Static tracing and executable source-contract evidence show:

- `initialModeState()` initialises it independently to empty selection;
- `switchMode()` preserves it with the rest of mode state;
- live Plan/3D/tree/inspector selection writes go to App `modelSelection`;
- no deliberate synchronisation from `modelSelection` to
  `WorkspaceModeState.selection` was found;
- no important live reader of `WorkspaceModeState.selection` was found on the
  traced product path.

The duplicate is therefore already divergent in memory after the first real
selection, even though its stale value is currently dormant and does not create
a second rendered selection.

Do not delete or rewrite it in #401. #425 must choose one session-selection
authority and remove, derive or deliberately synchronise the duplicate.

## Focus versus semantic selection conclusion

DOM keyboard focus and semantic selection are separate authorities today.
Tree/search/inspector/shell controls can receive focus without changing
`modelSelection`.

#425 must preserve this separation. A unified semantic-selection contract must
not become a DOM-focus store.

## Performance observation

No selection-specific full-project recomputation was found that justifies an
optimisation in #401.

- App `modelTree` is memoised from model/drawn-wall/active-level inputs and does
  not depend on `modelSelection`.
- ModelPanel memoises tree filtering/expansion/flattening from tree/query inputs.
- Selection rerenders the visible tree window and selection-dependent
  Plan/3D/inspector projections, which is expected.
- Current selected-wall derivation scans/maps current `drawnWalls`, but no
  measured performance problem was established.

No performance change is authorised by this audit.

## Deterministic evidence

The evidence intentionally separates geometry selection from browser layout so
a fragile drag coordinate cannot masquerade as the selection contract.

### Multi-selection state flow

Two deterministic layers prove scenario 5:

- `apps/web/src/canvas/canvas-interaction.test.ts` exercises the real
  `selectWallsInRegion` window/crossing selector, including multi-wall crossing
  results.
- `scripts/selection-authority-state-flow.test.mjs` verifies current source
  wiring: Plan emits `selectWallsInRegion(...)` through `onSelectMany`, App maps
  the first returned ID to `primary` and all remaining IDs to `secondary`, and
  `WorkspaceModeState.selection` remains the independently initialised duplicate
  representation recorded above.

### Browser projection/state transitions

`scripts/run-selection-authority-capability-check.mjs` drives the production
Vite bundle and records `benchmarks/results/selection-authority.json` plus a
screenshot. The browser portion covers:

1. Plan wall selection -> tree, inspector and 3D projection.
2. Tree wall selection -> Plan, inspector and 3D projection.
3. Plan -> 3D -> Plan semantic selection continuity.
4. Delete one selected target -> no stale semantic selection and one fewer
   drawn-wall row.
6. Active-level switch -> deterministic selection clear.
7. DOM focus movement -> semantic selection unchanged.
8. Escape -> semantic selection preserved; empty 3D click -> deterministic
   semantic clear.

Scenario 5 is deliberately recorded in the browser result as state-flow evidence
rather than re-tested through viewport-dependent marquee drag geometry.

`.github/workflows/selection-authority-evidence.yml` is a static evidence lane.
It does not mutate the branch. It checks evidence-file formatting, runs the
source-contract test plus the focused canvas-interaction Vitest suite, runs the
requested ZEUS compile command, installs Chromium, executes the browser probe
and uploads JSON/screenshot evidence.

## Exact work handed to #425

#425 should establish one canonical session-selection contract that defines:

1. one selected-ID set plus one explicit primary ID;
2. replace, extend and toggle semantics shared by Plan, 3D and tree;
3. window/crossing multi-selection without local surface stores;
4. invalid/deleted target reconciliation for canonical project IDs, not only
   `drawn-wall-*` IDs;
5. hidden/off-level policy, including whether selecting an off-level target
   changes context or remains selected but not projected;
6. one documented clear-selection command and explicit Escape ordering after
   overlays and active tools;
7. inspector target derivation from unified session selection plus canonical
   project data;
8. DOM focus and hover remaining separate from semantic selection;
9. resolution of the already-divergent dormant
   `WorkspaceModeState.selection` representation;
10. no persistence of selection into canonical `.arq` semantic data.

## Owner boundaries

- #389 owns canonical model -> Plan/3D/browser/inspector coordination and
  invalidation.
- #391 owns production project-browser/inspector behaviour.
- #425 owns the unified UI/session selection contract.
- #451/#455 own later level/context interaction work.
- PR #361 retains `App.tsx` and native persistence/session ownership until it is
  resolved.
- Agent proposal/highlight state must remain distinct from ordinary selection
  and canonical data.

## Closure gate

Statically and deterministically established at the revalidated integration
head:

- effective selection writers/readers are mapped;
- Plan/3D/tree/inspector authority direction is explicit;
- primary and multi-selection semantics are mapped;
- hover, DOM focus, active tool and canonical data are separated;
- level/project/delete/self-healing paths are traced;
- the duplicate workspace-mode selection is proven divergent but dormant;
- selection-related recomputation has been inspected without speculative
  optimisation;
- latest main drift through `c57f8353a0adf9130a33c1c23b8fffdefa5c5bf0`
  does not alter the audited selection runtime.

Still required before closing #401:

- the focused evidence workflow must PASS at the final exact evidence head;
- its JSON/browser evidence must agree with this map;
- the PR must merge without selection-runtime conflict;
- the same focused lane must pass on the resulting `main` head before #401 is
  closed.

Any contradiction must be recorded rather than repaired by implementing #425
inside #401.

## ZEUS regression handoff

#369 should treat the following as selection-authority regressions:

- a second writable semantic selection store becomes user-visible;
- renderer mesh IDs become canonical selected identities;
- Plan and 3D settle on different semantic selected IDs;
- inspector targets a stale/deleted object;
- tree/3D silently destroy multi-selection without an explicit replace action;
- semantic selection is conflated with hover or Agent proposal highlight;
- DOM focus moves merely because semantic selection changed;
- selection is written into canonical project data.

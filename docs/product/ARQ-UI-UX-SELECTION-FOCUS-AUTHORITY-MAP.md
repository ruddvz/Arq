# ARQ UI/UX selection and focus authority map

- Issue: #401
- Programme: #377
- Phase: UX-0
- Integration authority: `main`
- Revalidated integration head: `2d5a2ae73557049e0d5c2af01f6b0147942b1bcd`
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

Current overlap inspection found:

- PR #361 remains the active owner of `apps/web/src/App.tsx` and native
  session/persistence paths.
- PR #363 owns its browser-matrix workflow, script and validation document.
- No other open PR examined owns the live Plan, 3D, tree, inspector, workspace
  mode selection, or active level/view paths relevant to #401.
- #401 therefore keeps `App.tsx` read-only and adds only deterministic evidence
  plus this audit artefact.

Required issue #319 could not be resolved from the live repository. GitHub
reports no such issue, so this audit does not invent a contract for it.

## State domains

The current implementation has five different state domains. They must not be
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
- The inspector owns no selected ID. App derives its current target/properties
  from `modelSelection` plus current project/wall projection data.
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
- an empty point-selection result while Select is active can clear semantic
  selection;
- selected drawn-wall deletion clears selection after the operation;
- active native-level switch clears selection;
- project close/reset clears selection;
- Plan/3D view switching does not rewrite selection.

## Plan state

`PlanCanvas` receives semantic selection as a prop. It does not own a semantic
selection store.

Local Plan state is deliberately different:

- `hoveredId` is pointer hover only;
- marquee state exists only during drag until it emits `onSelectMany`;
- wall-draft state belongs to the Wall tool;
- marquee Escape is handled by the marquee interaction;
- wall-draft Escape is handled by the Wall tool.

The plan renderer consumes semantic selection only for visual treatment and
handles.

## 3D state

`ModelCanvas` receives the same semantic selection object as Plan.

Raycast hits use rendered mesh metadata to recover semantic `elementId`.
Renderer mesh identity is therefore projection detail, not canonical selection
identity. Multiple rendered solids may represent one selected semantic object.

3D currently replaces selection with a single primary. It does not provide the
same multi-selection input behaviour as Plan.

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
current wall/project state, then builds inspector groups and the selected
object description.

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
not rewrite `modelSelection`, so allowed semantic selection continuity is
preserved.

Workspace mode changes update `modeState.mode` and `previousMode`; they do not
replace App-level semantic selection.

## Escape and clear-selection ordering

There is no current global rule that Escape clears semantic selection.

Shell Escape handling closes an overlay or cancels the active tool. Plan has
more specific Escape handling for marquee and wall draft. Semantic selection
is not cleared merely because Escape was pressed.

The focused browser probe confirms the ordering to test:

1. focus a shell control and press Escape;
2. semantic selection must remain unchanged;
3. reactivate Select after Escape cancels it;
4. click empty Plan space;
5. the resulting null point selection clears semantic selection.

If #425 later introduces a central Escape-to-clear command, it must define its
ordering after overlays/tools instead of treating it as an existing contract.

## Dormant duplicate representation

`packages/workspace/src/mode-state.ts` also defines
`WorkspaceModeState.selection` with `primaryId` and `secondaryIds`.

Static tracing found:

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
- Selection still rerenders the visible tree window and selection-dependent
  Plan/3D/inspector projections, which is expected.
- Current selected-wall derivation scans/maps current `drawnWalls`, but no
  measured performance problem was established.

No performance change is authorised by this audit.

## Deterministic evidence

Existing repository probes already provide partial coverage:

- `scripts/run-model-canvas-capability-check.mjs` drives Plan selection into 3D
  and clears selection through an empty 3D click.
- `scripts/run-native-open-capability-check.mjs` opens the golden `.arq`
  fixture, changes active level, selects a canonical wall from the tree and
  observes its 3D highlight.

#401 adds `scripts/run-selection-authority-capability-check.mjs`, which drives
the production Vite bundle through the requested representative paths and
records `benchmarks/results/selection-authority.json` plus a screenshot.

The focused probe covers:

1. Plan wall selection -> tree, inspector and 3D projection.
2. Tree wall selection -> Plan, inspector and 3D projection.
3. Plan -> 3D -> Plan semantic selection continuity.
4. Delete selected targets -> no stale selection.
5. Marquee multi-select -> two selected rows with exactly one primary.
6. Active-level switch -> deterministic selection clear.
7. DOM focus movement -> semantic selection unchanged.
8. Escape -> selection preserved; reactivated Select + empty Plan click ->
   deterministic semantic clear.

`.github/workflows/selection-authority-evidence.yml` runs the focused browser
probe independently of PR #363's browser-matrix-owned files and verifies these
three #401 evidence files are Prettier-clean before execution.

Execution status remains pending until the focused workflow passes on the final
exact evidence head. #401 must not close before that pass exists.

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
- Agent proposal/highlight state must remain distinct from ordinary selection
  and canonical data.

## Closure gate

Statically proven at the revalidated integration head:

- effective selection writers/readers are mapped;
- Plan/3D/tree/inspector authority direction is explicit;
- primary and multi-selection semantics are mapped;
- hover, DOM focus, active tool and canonical data are separated;
- level/project/delete/self-healing paths are traced;
- the duplicate workspace-mode selection is proven divergent but dormant;
- selection-related recomputation has been inspected without speculative
  optimisation.

Still required before closing #401:

- the focused browser workflow must PASS at the final exact evidence head;
- its JSON/browser evidence must agree with this map;
- any contradiction must be recorded rather than repaired by implementing #425
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

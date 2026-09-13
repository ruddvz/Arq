# ARQ UI/UX selection and focus authority map

**Issue:** #401  
**Programme:** #377  
**Phase:** UX-0  
**Integration authority:** `main`  
**Revalidated integration head:** `14d333a225d6b606a8693f85246cacadb1c93ce3`  
**Evidence branch:** `codex/arq-401-selection-authority-evidence`  
**Evidence:** exact-head source/state-flow inspection plus `scripts/run-selection-authority-capability-check.mjs` browser probe  
**Runtime mutation scope:** none. This audit does not change selection behaviour.

## 1. Purpose

This map identifies who currently reads and writes selection, hover, focus, active tool, active level/view and inspector target state across Plan, 3D, model tree and inspector.

The goal is to let #425 unify behaviour without creating a second selection store or accidentally persisting UI selection into canonical `.arq` project data.

## 2. Integration and file-ownership authority

Live repository evidence establishes `main` as the practical integration branch for the active ARQ programme even though the repository default-branch pointer still names the older `claude/arq-cad-platform-research-ba8rav` branch. Issue #332 tracks that stale administrative pointer.

At the revalidated integration head:

- PR #361 remains open and owns `apps/web/src/App.tsx` plus native project session/persistence paths;
- PR #363 owns its browser-matrix workflow/script/document only;
- open dependency work touches manifests/lockfiles, not the selection runtime;
- no active PR other than #361 was found owning `PlanCanvas`, `ModelCanvas`, project-browser selection, inspector selection, workspace mode selection, or active level/view wiring.

Accordingly this issue keeps `App.tsx` read-only and adds evidence only in new files plus this audit artefact.

Required issue #319 could not be resolved from the live repository: GitHub reports no such issue. No contract has been inferred or fabricated for it.

## 3. State-domain separation

The current implementation has five distinct state domains. They must remain distinct:

### A. Semantic selection/session state

The live authority is App-level `modelSelection`:

```ts
const [modelSelection, setModelSelection] = useState<ModelPanelSelectionState>({
  primary: null,
  secondary: new Set(),
});
```

Shape:

- `primary: string | null`
- `secondary: ReadonlySet<string>`

The IDs are semantic/project element IDs where real project elements are involved. This is session/presentation state, not building truth.

### B. DOM keyboard focus

Browser focus is owned by focusable controls and overlay/focus-management components. Tree buttons, search fields, inspector inputs, modal controls and shell buttons may receive DOM focus without becoming semantic selection authority.

### C. Hover/transient pointer state

Plan hover and marquee state live inside `PlanCanvas`. Hover is layered over the resolved scene and is explicitly documented there as live pointer state, not project state. Marquee is transient until pointer-up emits a semantic selection result.

### D. Active tool state

App/workspace tool state controls Select/Wall/Pan/Fit and tool cancellation. Tool state is separate from selection. `Escape` currently closes an overlay or cancels the active tool; it does not globally clear semantic selection.

### E. Canonical project data

Canonical project/model data belongs to the semantic/project domain and operation owners. Selection stores IDs that reference that data. Selection is not persisted into `.arq` geometry and must never become project truth.

Allowed direction:

`session selection -> stable semantic IDs -> read canonical project state`

## 4. Effective current selection authority

The live product's effective cross-surface selection authority remains the App-level `modelSelection` state in `apps/web/src/App.tsx`.

Plan, 3D, tree, inspector and selection-aware context UI all project from that state. No renderer, tree component or inspector component owns another live semantic-selection writer on the traced path.

## 5. Cross-surface readers and writers

| Surface/state | Reads | Writes | Current semantics |
| --- | --- | --- | --- |
| Plan canvas | `modelSelection` | `onSelectElement`, `onSelectMany` | point select replaces; marquee replaces with first result primary and the rest secondary |
| 3D canvas | `modelSelection` | `onSelectElement` | raycast maps renderer hit back to semantic `elementId`; click replaces with one primary |
| Model tree | `modelSelection` | `onSelectNode` | row click replaces with one primary |
| Inspector | derived selected wall records | none | projects groups/accessible description from selected semantic IDs plus current wall data |
| Context actions | selection count and selected walls | delete clears selection after operation | no independent store |
| Active level | independent `activeNativeLevelId` | level controls | level switch clears semantic selection after replacing level projection |
| Active view | `tabs.activeId` / `activeTab.kind` | tab controls | Plan/3D switch does not rewrite semantic selection |
| Plan hover | local `hoveredId` | pointer move/leave | transient pointer state only |
| Plan marquee | local marquee state | pointer drag/Escape | transient until pointer-up emits `onSelectMany` |
| DOM focus | browser/component focus | native focus/overlay logic | does not write `modelSelection` |
| Active tool | workspace/App tool state | tool rail/shortcuts/Escape | independent from selection |

## 6. Plan selection contract

`PlanCanvas` receives the shared selection object and callbacks from App.

Current App wiring:

- `onSelectElement(elementId)` replaces selection with `primary = elementId`, `secondary = empty`;
- `onSelectMany(elementIds)` makes the first ID primary and the remainder secondary;
- clicking empty can send `null`, clearing semantic selection;
- Plan hover remains local;
- marquee remains local until completion;
- Escape during an in-progress marquee cancels the marquee at capture phase before shell Escape handling;
- wall-draft Escape belongs to the active wall tool, not semantic selection.

The plan renderer consumes selection for visual treatment and handles. Preview/hover state remains distinct from committed semantic selection.

## 7. 3D selection contract

`ModelCanvas` receives the same `modelSelection` object that Plan receives.

A rendered mesh is not selection authority. Raycast results are mapped through `userData.elementId` to the semantic element represented by the geometry. Multiple rendered solids may share one semantic element ID.

Current limitation: 3D writes a single primary and clears secondaries. It does not currently implement Plan-equivalent multi-selection.

## 8. Model-tree selection and focus contract

`ModelPanel` receives `modelSelection` and calls `onSelectNode(node.id)`.

Tree rows query whether they are selected and whether they are the primary selection. Row click writes one primary and clears secondaries.

The tree virtualiser uses `selection.primary` as the row it must keep mounted when that row falls outside the rendered window. This is a presentation optimisation, not a second semantic writer. It does not itself move DOM focus or mutate selection.

DOM focus remains native browser focus on row buttons/search controls. Selection can remain on one semantic object while keyboard focus moves to another shell control.

## 9. Inspector target derivation

The inspector does not own an independent selected-element ID.

App derives selected current-level wall records from `modelSelection` and `drawnWalls`, then passes property groups and an accessible description into `InspectorShell`.

This establishes the correct direction:

`semantic selection -> current canonical/project projection -> inspector`

Current limitation: the current rich inspector projection is strongest for wall selections that exist in `drawnWalls`. A semantic selection of another node type, or a wall not on the currently projected level, can remain selected in the tree while the inspector reports no wall selection. #391 remains the broader production browser/inspector owner.

## 10. Multi-selection and primary semantics

Current effective rules are deterministic:

- no selection: `primary = null`, `secondary = empty`;
- single selection: one primary, empty secondary set;
- Plan marquee: first returned ID becomes primary, remaining IDs become secondary;
- tree click: clicked node becomes sole primary;
- 3D click: hit semantic element becomes sole primary;
- empty Plan/3D point selection can clear selection;
- selected drawn-wall delete clears the selection;
- active native-level switch clears the selection.

The browser probe asserts that two marquee-selected walls produce two selected tree rows with exactly one primary row and a two-wall inspector projection.

## 11. Invalid/deleted target behaviour

### Explicit delete path

The drawn-wall context action collects currently selected wall IDs, performs one `remove-walls` operation and clears `modelSelection` after the operation.

### Undo/redo reconciliation

App has a reconciliation effect for `drawn-wall-*` IDs. When a drawn wall disappears from `drawnWalls`, dangling selected IDs are removed. If the primary vanished but a secondary survived, the first surviving secondary is promoted to primary.

### Current boundary

The reconciliation heuristic deliberately covers `drawn-wall-*` IDs. It is not a general canonical-project invalidation system. Native/project element invalidation must be governed by the semantic model/operation coordination owners rather than adding more App-local ID-prefix heuristics.

## 12. Active-level, hidden and off-level behaviour

### Level switch

`handleShowLevel(levelId)` replaces the level-specific wall/room/opening/placed-content projection and then clears `modelSelection`.

That is the current deterministic policy: switching active level clears selection rather than carrying a wall selection to another storey.

### Selected-but-hidden tree node

The model tree can visually mark a hidden node while still treating it as selected. Hidden state is presentation metadata on the row; it does not become a second selection authority.

### Off-level tree target

The native project tree is built from the whole project, while Plan/3D and current inspector wall projection use the active level. Therefore selecting a semantic wall from another level can produce a valid tree selection that has no current-level Plan/3D/inspector projection. A later level switch then clears selection.

This is deterministic but incomplete cross-surface product behaviour. #425 must define the desired selected-but-hidden/off-level policy. #401 does not redesign it.

## 13. Project and view transitions

### Project close/reset

Closing/resetting the native project clears `modelSelection` along with active native projection state.

### Plan <-> 3D

Active view is owned by tab state (`tabs.activeId`). Changing between Plan and 3D does not rewrite `modelSelection`, so allowed selection continuity is preserved.

### Mode changes

Workspace mode switching changes `modeState.mode` and `previousMode`; it does not synchronise or replace App-level `modelSelection`.

## 14. Escape and clear-selection contract

There is no current global "Escape clears semantic selection" rule.

Shell Escape handling is ordered around overlays and active tool cancellation. Plan has more specific capture-phase Escape handling for marquee and wall draft. None of those paths writes `modelSelection` merely because Escape was pressed.

Current deterministic semantic clear paths include an empty point-selection result (`onSelectElement(null)`) and explicit lifecycle actions such as selected-wall deletion, level switch, or project close/reset.

The #401 browser evidence therefore asserts both halves:

1. moving focus to a shell control and pressing Escape does not silently mutate semantic selection;
2. clicking empty Plan space through the Select/null interaction path clears semantic selection.

If #425 later decides Escape should clear selection after overlays/tools have declined it, that is a new central contract, not an inference to add here.

## 15. Dormant duplicate `WorkspaceModeState.selection`

`packages/workspace/src/mode-state.ts` defines another selection field:

```ts
selection: WorkspaceSelection
```

with shape:

- `primaryId`
- `secondaryIds`

`initialModeState()` initialises it independently to no selection. `switchMode()` preserves it by copying the mode state object, and its documentation describes relevant selection as persisting across modes.

Current App behaviour is different:

- real selection is written to `modelSelection`;
- no synchronisation into `modeState.selection` was found;
- no important live reader of `modeState.selection` was found on the traced product path;
- mode changes operate on `modeState` while Plan/3D/tree/inspector continue reading `modelSelection`.

Therefore this representation is **already divergent in memory after the first real selection**, even though it is currently dormant and does not produce two rendered selections.

That distinction matters: this is not merely a hypothetical future duplicate. It is an existing split representation whose stale half is currently unread.

Do not delete or rewrite it in #401. #425 must choose one session-selection authority and remove, derive or deliberately synchronise the other representation.

## 16. Focus versus semantic selection conclusion

DOM keyboard focus and semantic selection are separate current authorities.

Evidence from the traced components:

- tree rows/search are ordinary focusable controls;
- inspector summaries/inputs own their own native focus behaviour;
- modal/sheet focus management is component-specific;
- Plan tool keyboard handling belongs to canvas/tool interaction;
- App semantic selection setters are not called merely because focus moves.

The browser probe moves DOM focus through shell controls while holding a selected wall and asserts that the same inspector ID/tree selection survives.

#425 must preserve this separation. A unified selection contract must not become a DOM-focus store.

## 17. Performance observation

No selection-specific full-project recomputation was found that justifies speculative optimisation in #401.

Relevant current behaviour:

- App's `modelTree` is memoised from model/drawn-wall/active-level inputs and does not depend on `modelSelection`;
- `ModelPanel` memoises filter/expansion/flattening from tree/query inputs, so changing selection does not rebuild the full flattened tree from source;
- selection changes still rerender the visible tree window and recompute selection-dependent Plan/3D/inspector projection, which is expected;
- current selected-wall derivation scans/maps current `drawnWalls`, but no measured performance problem was established here.

No performance change is authorised by this audit.

## 18. Deterministic evidence

### Existing exact-path evidence already present on `main`

- `scripts/run-model-canvas-capability-check.mjs` already drives a real Plan selection into 3D, observes the shared 3D selection highlight, and clears selection from an empty 3D click.
- `scripts/run-native-open-capability-check.mjs` already opens the golden `.arq` fixture, changes active level through the real project UI, and selects a canonical project wall from the model tree before observing its 3D highlight.

### #401 focused evidence added by this audit

`scripts/run-selection-authority-capability-check.mjs` drives the production Vite bundle and records `benchmarks/results/selection-authority.json` plus a screenshot.

It covers the required scenarios:

| # | Scenario | Assertion |
| --- | --- | --- |
| 1 | Select wall in Plan | one tree row selected, inspector exposes selected semantic ID, 3D highlight appears |
| 2 | Select from tree | inspector semantic ID changes with tree target, Plan rendered selection changes, 3D highlight follows |
| 3 | Plan -> 3D -> Plan | semantic inspector ID and tree selection persist |
| 4 | Delete selected target(s) | deleted drawn walls disappear and tree/inspector selection clears; 3D has no stale highlight |
| 5 | Multi-select | two tree rows selected, exactly one primary, inspector reports two-wall selection |
| 6 | Switch active level | current semantic selection is cleared deterministically |
| 7 | Move DOM focus | Open/search controls receive focus without changing semantic target |
| 8 | Escape/clear | Escape preserves semantic selection; empty Plan click performs deterministic semantic clear |

The isolated workflow `.github/workflows/selection-authority-evidence.yml` installs Chromium and runs the probe for relevant pull requests. It is separate from PR #363's browser-matrix-owned files.

**Execution status:** pending branch CI at the time of this artefact update. #401 remains blocked from closure until the probe passes at the exact final evidence head.

## 19. Current gaps to hand to #425

#425 should establish one canonical session-selection contract with at least:

1. one selected-ID set plus one explicit primary ID;
2. replace/extend/toggle semantics shared by Plan, 3D and tree;
3. window/crossing multi-selection semantics without forcing tree/3D to invent local stores;
4. invalid/deleted target reconciliation for canonical project IDs, not only `drawn-wall-*` IDs;
5. explicit hidden/off-level policy, including whether selecting an off-level tree target reveals/switches context or remains selected-but-not-projected;
6. one documented clear-selection command and explicit Escape ordering after overlays/tools;
7. inspector-target derivation from the unified session selection plus canonical data;
8. DOM focus and hover remaining separate from semantic selection;
9. resolution of the already-divergent dormant `WorkspaceModeState.selection` representation;
10. no selection persistence into canonical `.arq` semantic data.

## 20. Domain-owner boundaries

- #389 owns canonical model to Plan/3D/browser/inspector coordination and invalidation.
- #391 owns production project-browser/inspector behaviour.
- #425 owns the unified UI/session selection contract.
- #451/#455 own later level/context interaction work.
- Agent proposal/highlight state must remain distinct from ordinary selection and canonical data.

## 21. Acceptance/closure state

### Proven statically at revalidated integration head

- effective selection writer/readers are mapped;
- Plan/3D/tree/inspector authority direction is explicit;
- primary/multi-selection rules are mapped;
- hover, DOM focus, active tool and canonical data are separated;
- level/project/delete/self-healing paths are traced;
- the dormant duplicate selection representation is proven already divergent but unread;
- selection-related recomputation was inspected without speculative optimisation.

### Required before closing #401

- focused browser workflow must PASS at the final exact evidence head;
- resulting JSON/browser evidence must agree with this map;
- any contradiction must be recorded rather than repaired through #425 scope.

## 22. ZEUS handoff

#369 should treat any of the following as selection-authority regression:

- a second writable selection store becomes user-visible;
- renderer mesh IDs become canonical selected identities;
- Plan and 3D show different selected semantic IDs after settling;
- inspector targets a stale/deleted object;
- tree/3D silently destroy multi-selection without an explicit replace action;
- semantic selection is conflated with hover or Agent proposal highlight;
- DOM focus is forcibly moved merely because semantic selection changed;
- selection is written into canonical project data.

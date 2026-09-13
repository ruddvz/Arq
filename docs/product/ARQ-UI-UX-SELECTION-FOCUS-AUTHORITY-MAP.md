# ARQ UI/UX selection and focus authority map

**Issue:** #401  
**Programme:** #377  
**Phase:** UX-0  
**Audited branch/head:** `main` @ `48c5a7399166a6288a77b76a374b5b660ae471a6`  
**Evidence type:** static repository/state-flow inspection  
**Status:** current authority map, not a browser interaction claim

## 1. Purpose

This map identifies who currently reads and writes selection, hover, focus and inspector target state across Plan, 3D, model tree and inspector.

The goal is to let #425 unify behaviour without creating a second selection store or accidentally persisting UI selection into canonical `.arq` project data.

## 2. Effective current selection authority

The live product's effective cross-surface selection authority is the App-level state in `apps/web/src/App.tsx`:

```ts
const [modelSelection, setModelSelection] = useState<ModelPanelSelectionState>({
  primary: null,
  secondary: new Set(),
});
```

Its value shape is:

- `primary: string | null`
- `secondary: ReadonlySet<string>`

The IDs are semantic/project element IDs where real project elements are involved. The state itself is session/presentation state and is not canonical building data.

## 3. Cross-surface readers and writers

| Surface | Reads | Writes | Current semantics |
| --- | --- | --- | --- |
| Plan canvas | `modelSelection` | `onSelectElement`, `onSelectMany` | single click can replace selection; marquee can replace with primary + secondary set |
| 3D canvas | `modelSelection` | `onSelectElement` | click writes one primary and clears secondary selection |
| Model tree | `modelSelection` | `onSelectNode` | tree click writes one primary and clears secondary selection |
| Inspector | derived from `modelSelection` | no independent selection writer in audited path | selected drawn walls drive current property groups and accessible description |
| Status/context UI | selection count derived from `modelSelection` | none | reports one primary plus secondary count |
| Delete/context action | reads `modelSelection` | clears after operation | current drawn-wall delete path clears selection after removing selected walls |

This means Plan, 3D, tree and inspector are already coordinated through one effective App state rather than four independent stores.

## 4. Plan selection contract

`PlanCanvas` receives the shared selection object and callbacks from App.

Current App wiring:

- `onSelectElement(elementId)` replaces selection with `primary = elementId`, `secondary = empty`;
- `onSelectMany(elementIds)` makes the first ID primary and the remainder secondary;
- clicking empty can send `null`, clearing single selection;
- Plan hover remains local to `PlanCanvas` and is not promoted into shared selection state.

The plan renderer consumes selection for visual treatment and handles. Preview/hover state must remain distinct from committed semantic selection.

## 5. 3D selection contract

`ModelCanvas` receives the same `modelSelection` object that Plan receives.

Its selection prop uses the same primary/secondary shape used by the renderer. Clicking a 3D element calls the App writer with one semantic element ID, which becomes the same selection later read by Plan, tree and inspector.

Renderer mesh identity is not selection authority. `ModelCanvas` maps renderer hits back to semantic element IDs and the host stores those IDs.

Current limitation: the audited App callback from 3D writes a single primary and clears secondaries. Multi-selection parity with Plan is not yet present.

## 6. Model tree selection contract

`ModelPanel` receives `modelSelection` and calls `onSelectNode(node.id)`.

The host replaces selection with the clicked node as the only primary target.

`ModelPanelSelectionState` intentionally mirrors the Plan selection value shape instead of importing semantic model types. Tree rows query:

- whether the row is selected;
- whether it is the primary selection.

Current limitation: no modifier-based extend/toggle path is wired by App. Tree interaction therefore collapses any Plan multi-selection to one selected node.

## 7. Inspector target derivation

The current inspector does not own an independent selected-element ID.

App derives `selectedDrawnWalls` from the IDs in `modelSelection` and passes the resulting groups/description into `InspectorShell`.

This is the correct authority direction: selection identifies targets, then the inspector projects properties from canonical/current project data.

Current limitation: the audited inspector derivation is strongest for wall selection. Selection may contain other semantic IDs from the project/tree/3D, but current property-group construction does not prove equivalent rich inspection for every element category. #391 remains the broader production browser/inspector owner.

## 8. Selection lifecycle and self-healing

### Active level change

When the active native level changes, App clears `modelSelection`.

Reason recorded in code: a wall ID from another level should not leave the inspector describing an object that is not visible on the current level.

This is a safe current policy, although #425/#451/#455 may later define a more explicit off-level selection model.

### Project close/reset

Project reset clears selection.

### Undo/delete of drawn walls

App contains a reconciliation effect for `drawn-wall-*` IDs. If undo/redo removes the primary selected drawn wall, it removes dangling IDs and can promote a surviving secondary to primary.

The current reconciliation deliberately focuses on drawn-wall IDs. Rich native element invalidation should continue to be governed by the semantic operation/invalidation owners rather than expanded with local ID heuristics.

## 9. Multi-selection and primary-selection semantics today

Current effective rules inferred from the real App wiring:

- no selection: `primary = null`, `secondary = empty`;
- single selection: one `primary`, empty secondary set;
- Plan marquee: first returned ID becomes primary, remaining IDs become secondary;
- 3D click: selected hit becomes sole primary;
- tree click: selected node becomes sole primary;
- inspector target derives from shared IDs;
- deleting current selected drawn walls clears the selection;
- active native level change clears selection.

These rules are consistent enough to use as the starting point for #425, but they are not yet a complete product contract for modifier extend/toggle, cross-level selection, mixed-type multi-selection or keyboard tree selection.

## 10. Duplicate dormant selection representation found

`packages/workspace/src/mode-state.ts` defines `WorkspaceModeState` with its own field:

```ts
selection: WorkspaceSelection
```

`WorkspaceSelection` uses another equivalent shape:

- `primaryId`
- `secondaryIds`

The mode-state documentation says selection is preserved when switching modes.

However, in the audited App:

- `modeState` is created through `initialModeState()`;
- the effective product selection is the separate `modelSelection` state;
- no read of `modeState.selection` was found;
- `setModeState` is used for mode switching, not for syncing the effective selection.

Therefore `modeState.selection` is currently a **dormant duplicate representation**, not the effective selection authority.

This is not evidence of two currently competing rendered selections because the dormant value is not consumed by the product path inspected. It is still an architecture drift risk: a future component could read the stale mode-state selection and diverge from Plan/3D/tree.

#425 should choose one session selection authority and remove, derive or explicitly synchronise the duplicate representation. Do not allow both to become writable authorities.

## 11. Hover authority

Plan hover is local interaction state in `PlanCanvas`.

3D hover/render treatment, where present, belongs to the 3D view/renderer session layer.

Hover should not be stored as canonical project data and should not silently replace selection. #425 may standardise cross-surface hover/reveal behaviour later, but a global hover store is not required merely for visual consistency.

## 12. Focus is not selection

Keyboard/DOM focus and semantic selection are separate concepts.

Current evidence:

- `ModelPanel` uses native buttons for rows and keeps a selected/focused row mounted through tree virtualisation logic;
- `WorkspaceSheet` independently stores/restores DOM focus across open/close;
- command palette/modal focus handling belongs to modal components;
- Plan canvas focus owns canvas keyboard interaction;
- selecting an element does not mean the DOM focus should always move to its inspector/tree row.

#425 and #429 must keep this separation explicit. A single object should not attempt to represent both selected semantic IDs and the currently focused DOM control.

## 13. Current cross-surface gaps

### Gap A: dormant duplicate mode selection

`WorkspaceModeState.selection` can drift permanently from effective `modelSelection` because App does not synchronise or consume it.

### Gap B: multi-selection parity

Plan can produce multi-selection, but audited tree and 3D callbacks replace it with one primary.

### Gap C: modifier semantics are not one documented contract

The effective App writers replace selection. A complete shared contract for extend/toggle/window/crossing/clear across pointer and keyboard surfaces is not yet centralised.

### Gap D: inspector coverage is narrower than selection coverage

The shared selection can refer to more project node types than the current wall-focused inspector projection proves.

### Gap E: cross-level policy is currently clear-selection

That is safe, but later level isolation/reveal work needs an explicit policy for selected-but-hidden/off-level targets rather than each surface inventing one.

### Gap F: focus restoration is distributed

Modal/sheet components have their own focus contracts. Cross-surface reveal/select flows need to preserve those contracts rather than treating selection change as focus movement.

## 14. Canonical data and persistence boundary

Selection must remain outside semantic project persistence.

Allowed relationship:

`session selection -> stable semantic IDs -> read canonical project state`

Not allowed:

- renderer object becomes selected project authority;
- selected IDs are written into building geometry merely because the UI selected them;
- tree/inspector owns an independent semantic object copy;
- a restored stale selection reveals unavailable project data;
- mode switching rewrites project data to preserve selection.

If session restoration of selection is later desired, it must be an explicit presentation/session preference contract and must self-heal against missing IDs.

## 15. Required consequences for #425

#425 should establish one canonical session-selection contract with at least:

- selected semantic IDs;
- one explicit primary ID;
- extend/toggle/replace semantics;
- window/crossing selection semantics;
- clear semantics;
- invalid/deleted target self-healing;
- hidden/off-level target policy;
- derivation of inspector target;
- deliberate distinction from hover and DOM focus;
- no `.arq` semantic persistence.

It must also resolve the dormant `WorkspaceModeState.selection` representation rather than leaving it available as a future second authority.

## 16. Relationship to domain owners

- #389 owns canonical model to Plan/3D/browser/inspector invalidation and stable semantic coordination.
- #391 owns the production browser/inspector surface.
- #425 owns the UI/session selection contract.
- #451/#455 own later level selection/context interactions.
- #479 will later add Agent proposal highlight state, which must remain distinct from ordinary selection and canonical data.

## 17. Acceptance status for #401

### Satisfied by this static audit

- effective selection writer/readers are mapped;
- Plan/3D/tree/inspector authority direction is explicit;
- current primary and multi-selection behaviour is documented;
- selection versus hover/focus is separated;
- project/level/delete self-healing paths are identified;
- dormant duplicate `WorkspaceModeState.selection` is identified;
- cross-surface gaps are bounded for #425/#391/#451/#455.

### Still required before closing #401

- run focused browser evidence proving Plan -> 3D -> tree -> inspector selection round-trip at exact closing head;
- run multi-selection, empty-click clear and active-level switch cases;
- refresh ownership if active App/root-state PRs change the state model;
- verify focus behaviour in the browser rather than inferring DOM focus solely from component code;
- feed any final contradiction into #425 before UX-2 starts.

## 18. ZEUS handoff

#369 should treat any of the following as selection-authority regression:

- a second writable selection store becomes user-visible;
- renderer mesh IDs become canonical selected identities;
- Plan and 3D show different selected semantic IDs after settling;
- inspector targets a stale/deleted object;
- tree/3D multi-select unexpectedly destroys selection without a documented replace action;
- Agent proposal highlight is conflated with ordinary selection;
- focus is forcibly moved merely because semantic selection changed.

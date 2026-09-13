# ARQ UI/UX workspace ownership map

**Issue:** #396  
**Programme:** #377  
**Phase:** UX-0  
**Audited branch/head:** `main` @ `ea99da3f6e998ccfe79799bd4f40e0a3622db7ba`  
**Evidence type:** static repository inspection + live PR ownership preflight  
**Status:** current ownership map, not a runtime/browser conformance claim

## 1. Purpose

This map answers one question for later UI agents: **which existing ARQ system owns each workspace region/state today?**

It prevents UX-1 work from creating a second shell, second panel store, second responsive policy, second selection authority or accidental project-state persistence for presentation-only UI.

Live code and exact-head evidence outrank this document. Re-run the ownership preflight whenever root shell, workspace state or active PR ownership changes materially.

## 2. Current branch and ownership warning

Repository default branch still points at `claude/arq-cad-platform-research-ba8rav`, while current open PRs discovered during this audit target `main`. #332 owns canonical branch authority. This audit was intentionally performed against the active `main` line used by current PRs, but agents must re-discover integration authority rather than assuming `main` forever.

PR #361 is a live legacy owner of:

- `apps/web/src/App.tsx`
- `apps/web/src/project/native-project-session.ts`
- `apps/web/src/project/native-project-session.test.ts`
- `apps/web/src/project/workspace-persistence.ts`
- `apps/web/src/project/workspace-persistence.test.ts`

Therefore `App.tsx` is a **serialised/high-conflict path** until #361 is merged, retired or explicitly reconciled. This audit inspected it but did not mutate it.

## 3. Ownership layers

ARQ currently has four distinct UI responsibility layers. Keep them distinct.

### A. Product host/orchestration: `apps/web/src/App.tsx`

Current responsibilities include:

- constructing the real product shell slots;
- owning/binding current workspace state instances;
- coordinating current mode, tabs, panels, tools, touch sheets and inspector/browser state;
- hosting the shared `modelSelection` session state used by Plan, 3D, browser/inspector paths;
- selecting Plan, 3D and project-overview viewport content;
- binding command execution and command feedback;
- binding native project/open/persistence/publication state into user-facing shell surfaces;
- mounting global/transient UI outside `WorkspaceRoot`, including command palette and project/file dialogs.

`App.tsx` is not a licence to put every future interaction in the root component. UX work should move reusable presentation contracts into existing packages where appropriate while preserving one orchestration authority.

### B. Workspace composition: `packages/design-system/src/workspace/workspace-root.tsx`

`WorkspaceRoot` is the current **composition authority** for the normal editor workspace. It receives the existing UI as slots rather than rebuilding semantic/product behaviour locally.

Its contract includes slots for:

- project bar;
- phone project bar;
- tab strip;
- compact view control;
- tool rail;
- project browser;
- viewport;
- inspector;
- context bar;
- status bar;
- transient tools/view/review sheet content;
- panel resize callbacks and touch-sheet state.

It also owns the desktop/touch spatial composition around those slots. Later shell redesign work should extend this authority rather than create a parallel root shell.

### C. Presentation/session state contracts: `packages/workspace/src/**`

`@arq/workspace` owns reusable workspace policy/state, including:

- responsive/platform classification;
- panel layout/docking/collapse state;
- browser-panel state;
- view-tab state;
- inspector-tab state;
- mode state;
- tool state;
- capability gates;
- project-overview state;
- touch sheet/drawer state;
- keyboard-map policy;
- tree virtualisation helpers.

Important invariant: panel, drawer, sheet and similar workspace state is **presentation/session state**, not canonical `.arq` building data.

### D. Visual shell/workspace components: `packages/design-system/src/shell/**` and `packages/design-system/src/workspace/**`

These packages own reusable visual/control primitives and projections such as:

- `TopBar`
- `ToolRail`
- `InspectorShell`
- `ModelPanel`
- `ContextBar`
- `StatusBar`
- `ProjectTabStrip`
- `CompactViewControl`
- `ProjectBrowserPanel`
- `InspectorPanel`
- `PanelResizeHandle`
- `ProjectOverviewSurface`
- `WorkspaceSheet`
- `PhoneDock`
- `PhoneProjectBar`
- `TabletDrawerBar`
- view kind labels/switchers and related workspace controls.

Do not clone these locally in `App.tsx` or individual feature canvases merely for visual redesign.

## 4. User-reachable workspace region map

| Region | Current owner | State authority | Notes / constraints |
| --- | --- | --- | --- |
| Overall editor composition | `WorkspaceRoot` | host props + `@arq/workspace` policies | Extend, do not replace |
| Root product binding | `App.tsx` | app orchestration | High conflict, currently reserved by PR #361 |
| Project/global top bar | `TopBar` passed by `App.tsx` | command/project state from host | Shell primitive, not project model owner |
| Project tabs | `ProjectTabStrip` | workspace view-tab state | Presentation/navigation state |
| Desktop tool rail | `ToolRail` | tool state + command binding | Tool activation must still reach canonical command/operation path |
| Mode switching | workspace mode state + mode rail/shell controls | `@arq/workspace` mode state | Presentation/workflow context, not building semantics |
| Left project browser | `ProjectBrowserPanel` | browser projection + shared project/session state | Projection of canonical project data, not owner of element semantics |
| Main viewport | `App.tsx` selects `PlanCanvas`, `ModelCanvas` or overview | canonical model + view/session state | Plan/3D canvases own viewport interaction/rendering, not outer shell |
| Right inspector | `InspectorPanel` + `InspectorShell` | shared selection + inspector tab/form state | Form edits must route through canonical operations |
| Context bar | `ContextBar` | active tool/context contribution | Should converge with UX-2 tool lifecycle |
| Status bar | `StatusBar` | explicit status from host systems | Must not infer durability |
| Resizers | `PanelResizeHandle` + panel layout state | `@arq/workspace` panel policy | Width/state presentation only |
| Tablet drawers/sheets | `TabletDrawerBar` + `WorkspaceSheet` | workspace sheet state | One transient touch sheet at a time |
| Phone dock/project bar | `PhoneDock`, `PhoneProjectBar` | responsive/workspace state | Bounded phone composition, not compressed desktop |
| Compact view controls | `CompactViewControl` / view switchers | view/session state | View state only |

## 5. Viewport content is not shell authority

`PlanCanvas.tsx` and `ModelCanvas.tsx` are user-reachable content surfaces inserted into the viewport slot. They own renderer/input behaviour for their views, but they do not own global shell composition.

Current App wiring uses a shared `modelSelection` session state across the Plan/3D/inspector/browser flow. #401 maps that state in detail and #425 later owns unification. UX-1 shell work must not introduce local per-panel selection stores.

## 6. Responsive composition authority

`packages/workspace/src/responsive.ts` is the current responsive-policy authority. It classifies by viewport width, orientation and pointer capability rather than user agent.

Current policy constants/intent include:

- phone: up to 600 px;
- coarse-pointer tablet portrait: up to 900 px in portrait;
- coarse-pointer tablet landscape: up to 1280 px;
- compact desktop: up to 1200 px;
- larger desktop compositions beyond that;
- reference viewport slots around common desktop, tablet and phone sizes.

Current docking intent:

| Composition | Browser/inspector policy | Interaction intent |
| --- | --- | --- |
| Desktop | both may remain docked/floating according to current composition policy | full canvas-first authoring |
| Compact desktop | constrained docking, with left-side priority | preserve canvas floor before chrome |
| Tablet landscape | transient drawer/sheet composition | touch/Pencil-first, not squeezed desktop |
| Tablet portrait | transient drawer/sheet composition | preserve visible canvas and touch targets |
| Phone | bottom dock/project bar + transient sheets | review/bounded light editing, not full desktop parity |

`packages/workspace/src/panel-layout-state.ts` reconciles panel openness/docking against this policy and remembers docked preferences separately from touch-sheet presentation.

## 7. Touch-sheet ownership

`packages/design-system/src/workspace/workspace-sheet.tsx` is the current transient touch-sheet presentation component.

`packages/workspace/src/sheet-state.ts` owns its presentation state and enforces a single open touch sheet at a time.

Current focus behaviour in `WorkspaceSheet` stores prior focus and restores it on close/unmount when possible. Escape dismissal is supported where configured.

Do not persist touch-sheet openness into `.arq` semantic project state.

## 8. Surfaces mounted outside `WorkspaceRoot`

The shell is not fully described by `WorkspaceRoot` alone. `App.tsx` currently mounts important transient/global surfaces as siblings outside it. UX-1/#412 must include them in the overlay/layer contract.

Known current examples include:

- `CommandPalette`;
- publication/native-project notice dialog through `ArqModalDialog`;
- `FileOpenPanel` full-viewport flow;
- `CommandFeedbackRegion`;
- a small fixed history/debug/status text surface near the viewport edge.

These are high-value z-index/focus/collision audit targets. They must not be ignored when the canvas-first shell is visually reorganised.

## 9. Panel state contract

`packages/workspace/src/panel-layout-state.ts` currently defines panel presentation state for:

- project browser;
- inspector;
- review;
- AI;
- diagnostics;
- tasks.

The state contract distinguishes docked preference from current responsive presentation and derives width constraints from registry/policy rather than letting each component invent them.

UX-1 panel work should extend this contract rather than storing width/open state independently in individual panels.

## 10. Presentation state vs canonical project truth

| State/data | Classification | Authority direction |
| --- | --- | --- |
| Panel open/collapsed/width | presentation | `@arq/workspace` |
| Touch sheet/drawer open | presentation | `@arq/workspace` |
| Workspace mode/view tab | session/workspace | `@arq/workspace` + host |
| Camera/viewport display state | view/session | view owner, never renderer object as canonical project data |
| Current UI selection | session/presentation reference to canonical IDs | mapped by #401/#425 |
| Building elements/geometry | canonical semantic project data | model/operation packages, not shell |
| Native working-copy durability | persistence authority | native session/persistence system, projected by shell only |
| Publish result | publication authority | #371/canonical publication path, projected by shell only |
| Import staging | pre-commit external workflow | adapter/fidelity contract, not shell state |
| Agent proposal/review | governed Agent proposal authority | Agent system, projected by workspace |

## 11. High-conflict files/interfaces

Treat these as serialised or explicitly coordinated during UX-1/UX-2:

1. `apps/web/src/App.tsx`
   - binds almost every workspace surface;
   - currently modified by PR #361;
   - root-shell edits should not overlap casually.

2. `packages/design-system/src/workspace/workspace-root.tsx`
   - canonical shell composition host;
   - changes affect desktop/touch surfaces together.

3. `packages/workspace/src/panel-layout-state.ts`
   - panel authority across multiple UI surfaces.

4. `packages/workspace/src/responsive.ts`
   - responsive/docking policy shared across desktop/tablet/phone.

5. `packages/workspace/src/sheet-state.ts`
   - one-at-a-time transient touch-sheet state.

6. `packages/design-system/src/shell/**` and `packages/design-system/src/workspace/**`
   - reusable shell primitives; broad token or behaviour changes have cross-surface blast radius.

7. Shared selection/command/tool state interfaces
   - detailed ownership is delegated to #398/#401 and later UX-2 issues, but shell work must not fork them.

## 12. Library-only / legacy candidates requiring confirmation

`packages/design-system/src/shell/index.ts` still exports prototype iPad shell compositions including `ipad-landscape-shell` and `ipad-portrait-shell`.

The current product host inspected in `App.tsx` uses `WorkspaceRoot`, `TabletDrawerBar`, `WorkspaceSheet`, `PhoneDock` and `PhoneProjectBar` rather than those prototype iPad shell compositions.

Therefore the old iPad shells are classified here as **library-only / legacy candidates**, not confirmed dead code. Before deleting them, #396/#493 or the owning cleanup issue must perform a full repository consumer search and verify that tests, stories, examples or future approved paths do not still depend on them.

## 13. Overlay/z-index ownership boundary

This audit identifies the owners and collision surfaces but does not declare a final z-index/token hierarchy. #403 owns the token/local-constant/layer inventory and #412 will define the product overlay-zone contract.

Current risks to reconcile in those issues include:

- fixed/absolute controls inside shell primitives;
- `WorkspaceSheet` overlays;
- command palette;
- modal/file-open flows;
- tool/context feedback;
- future level selector;
- future Agent/Review Centre highlighting;
- current debug/history/status fixed surface.

Do not solve collisions by arbitrary escalating local z-index values.

## 14. Safe UX-1 sequencing derived from this map

### Not ready for broad mutation

- #407 desktop shell is blocked by this map's downstream reconciliation, #403 token/layer audit, #493 owner graph and live PR #361 ownership of `App.tsx`.
- Any UX-1 lane requiring root App composition must wait until #361 is merged/retired/reconciled.

### Can prepare after UX-0 evidence

- #409 panel behaviour can extend the existing panel-layout contract once its exact current behaviour is tested.
- #412 overlay-zone work can proceed after #403 completes layer/token evidence and active overlay owners are confirmed.
- #414 tablet and #416 phone should follow the panel/overlay contracts rather than fork responsive logic.
- #418 reusable shell-state primitives can proceed with careful coordination if it can avoid root App conflicts.

## 15. Acceptance status for #396

### Satisfied by this static audit

- every major shell region has a current owning component/package direction;
- high-conflict root/shared files are identified;
- responsive compositions and panel/touch policies are mapped;
- presentation/session state is distinguished from canonical project data;
- known outside-root overlays are identified;
- legacy/library-only iPad shell candidates are recorded without falsely declaring them dead;
- UX-1 now has an explicit extension/serialization direction.

### Still required before closing #396

- re-run repository/PR ownership at the eventual closing head;
- verify full consumers for legacy iPad shell candidates before any cleanup claim;
- run or link focused existing workspace-layout/browser evidence at the current closing head;
- capture any contradictions discovered by #403/#493 that change shell ownership;
- update this map if PR #361 or root composition changes before the phase gate.

## 16. ZEUS handoff

#369 should use this map during the first UX-0/UX-1 reconciliation to reject:

- a second workspace root;
- local panel-width/open stores that bypass `@arq/workspace`;
- mobile/tablet compositions that simply squeeze desktop CSS;
- shell controls that directly own semantic project state;
- duplicated selection/command authority;
- arbitrary z-index escalation outside the #403/#412 contract;
- root App edits that overwrite a live owner without reconciliation.

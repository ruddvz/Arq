# ARQ UI/UX workspace ownership map

**Issue:** #396  
**Programme:** #377  
**Phase:** UX-0  
**Runtime evidence head:** `main` @ `14d333a225d6b606a8693f85246cacadb1c93ce3`  
**Audit branch:** `codex/ux-0-1-396-exact-head-evidence`  
**Evidence:** exact-head source inspection + complete open-PR filename preflight + exact-head Vitest + exact-head real Chromium capability checks  
**Status:** exact-head ownership/evidence map. Runtime code was not changed by #396.

## 1. Purpose and authority

This map records which existing ARQ system owns each workspace region and presentation state so later UX work can extend one authority instead of creating a second shell, panel store, responsive policy, navigation system or semantic project-state owner.

Authority order for this audit is:

1. exact-head working code and executable evidence;
2. accepted current contracts/ADRs;
3. current programme/coordination documents;
4. older planning material.

The requested `docs/product/ARQ-UI-UX-MASTER-EXECUTION-PLAN-v1.0.md` is not present on the audited `main` head. It exists on the still-configured historical default branch and is therefore planning context only, not current implementation authority.

## 2. Integration authority and live ownership preflight

GitHub still reports `claude/arq-cad-platform-research-ba8rav` as the configured default branch. #332 records the non-destructive cutover and requires agents to resolve authority from live history and PR bases rather than trust the default branch name.

For #396 the current integration authority resolves to `main` @ `14d333a225d6b606a8693f85246cacadb1c93ce3` because:

- the current UX coordination artefacts used by #396 are on `main`;
- the exact-head unit and browser capability runs were executed on this `main` SHA;
- PR #361, the only current open PR touching the audited workspace runtime paths, targets `main`;
- current branch history and #332 identify `main` as the active implementation line even though repository default configuration has not completed its cutover.

A full current open-PR filename sweep found only one live runtime overlap with the audited paths:

- **PR #361** owns `apps/web/src/App.tsx` plus native project session/persistence files. `App.tsx` remains serialised/high-conflict and was not edited by #396.

Other current open PRs inspected are research, validation, ZEUS, marketing/planning, dependency or workflow lanes. None adds a second owner under `packages/design-system/src/workspace/**`, `packages/workspace/**` or the current shell/modal/sheet runtime.

The #317/#319 enforced claim system is still programme work. Existing open PRs are therefore treated as legacy ownership exactly as #367/#493 require.

## 3. Canonical responsibility layers

### A. Product host/orchestration: `apps/web/src/App.tsx`

Owns product integration, including:

- constructing real shell slots;
- binding current workspace/session state instances;
- selecting Plan, 3D or project-overview viewport content;
- binding project/open/read-only/persistence/publication state to shell projections;
- coordinating command execution/feedback;
- hosting shared session selection used across Plan, 3D, browser and inspector paths;
- mounting important global/transient UI outside `WorkspaceRoot`.

`App.tsx` is an integration surface, not a new reusable shell authority. It is currently reserved by PR #361.

### B. Workspace composition: `packages/design-system/src/workspace/workspace-root.tsx`

`WorkspaceRoot` is the normal editor **composition authority**. It accepts existing product UI as slots and owns how those slots compose spatially across desktop, tablet and phone bands.

It receives project/phone bars, view controls, rail, browser, viewport, inspector, context/status surfaces, touch-sheet content, panel-resize callbacks and touch-sheet state. It also applies the modal inert boundary when a full bottom sheet covers the shell.

### C. Presentation/session policy: `packages/workspace/src/**`

`@arq/workspace` owns reusable presentation/session policy:

- responsive/platform classification;
- panel docking/open/width state;
- browser-panel state;
- view-tab state;
- inspector-tab state;
- mode state;
- tool state;
- capability gates;
- project-overview state;
- touch-sheet/drawer state;
- keyboard/back policy;
- tree virtualisation helpers.

Panel, drawer and sheet state is presentation/session state. It is not canonical `.arq` building data.

### D. Reusable visual/control surfaces

`packages/design-system/src/shell/**` and `packages/design-system/src/workspace/**` own reusable shell/workspace visual projections such as `TopBar`, `ToolRail`, `InspectorShell`, `ContextBar`, `StatusBar`, `ProjectTabStrip`, `CompactViewControl`, `ProjectBrowserPanel`, `InspectorPanel`, `PanelResizeHandle`, `ProjectOverviewSurface`, `WorkspaceSheet`, `PhoneDock`, `PhoneProjectBar`, `TabletDrawerBar` and view switchers.

Do not clone these locally in `App.tsx`, Plan or 3D for a visual redesign.

## 4. Exact-head surface ownership and behaviour map

| Surface | Component owner | State owner / classification | Root integration | Responsive composition | Focus, modal, back | Layer relation | Load boundary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Top/project bar | `TopBar` | host project/command/save-sync projections; semantic truth remains in project/persistence authorities | slot from `App.tsx` into `WorkspaceRoot` | normal project bar on desktop/tablet; bounded phone project bar on phone | normal shell controls | shell raised tier / normal shell | always with shell |
| View switching | `ViewKindSwitcher`, `ProjectTabStrip`, `CompactViewControl` | `@arq/workspace` view-tab/session state | `App.tsx` binds controls into root slots | visible direct switcher on docking bands; compact current-view control on phone | keyboard semantics owned by controls/state policy | shell chrome | always; target 3D content is lazy |
| Mode rail | shell/workspace mode controls | `@arq/workspace` mode state; workflow/session, not building semantics | root shell slot/control binding | desktop/compact presentation; rails removed on touch bands | ordinary control focus | shell chrome | always where platform permits |
| Tool rail | `ToolRail` | `@arq/workspace` tool state + command binding; presentation/workflow | root `toolRail` slot | desktop/compact; removed on touch bands and represented through touch interaction owner | ordinary control focus; touch sheet state handles back | shell chrome | always where platform permits |
| Project browser | `ProjectBrowserPanel` | browser projection + panel state; canonical elements remain model-owned | root browser slot | docked/floating on desktop policy; tablet drawer or touch sheet; phone sheet/dock entry | overlay Escape where configured; sheet back through sheet state | docked shell or overlay/sheet | always mounted as supplied content; presentation varies |
| Inspector | `InspectorPanel` + `InspectorShell` | shared selection reference + inspector/form/session state; edits route to canonical operations | root inspector slot | docked/floating desktop; tablet drawer/sheet; phone sheet | overlay Escape; touch back closes sheet first | docked shell or overlay/sheet | always mounted as supplied content; presentation varies |
| Status surface | `StatusBar` | explicit host status projections; does not own durability | root `statusBar` slot | retained across bands according to shell composition | not modal | shell status region | always |
| Context/HUD | `ContextBar` plus tool-owned HUD such as wall HUD | active-tool/context contribution; operation semantics remain tool/command owned | context slot plus view/tool overlays | responsive placement without becoming canonical state | wall-HUD browser check covers escape/shortcut ownership | named context-HUD tier is above shell; #403 owns token audit | tool/context dependent |
| Command palette/modal boundary | `CommandPalette` through shared `ArqModalDialog` | command registry/session UI | mounted by `App.tsx` outside `WorkspaceRoot` | global overlay across bands | real-browser check proves focus entry, trap, Escape/outside close and exact trigger focus return | shared overlay backdrop/surface tiers | transient, mounted on demand |
| Canvas viewport | `WorkspaceRoot` viewport slot; content selected by `App.tsx` | canonical model + view/session state | central root viewport | canvas floor protected on docking bands; canvas-first touch bands | view-specific input/focus | base canvas beneath shell/overlays | Plan eager; 3D `ModelCanvas` lazy via `React.lazy` + `Suspense` |
| Floating desktop overlays | `WorkspaceRoot` overlay panel composition | `@arq/workspace` panel mode/open state; presentation-only | root composition | used when canvas floor/policy floats a panel | Escape dismisses overlay; non-modal so canvas stays usable | shell/floating overlay; #403/#412 govern final tier contract | conditional |
| Tablet landscape drawers | `TabletDrawerBar` + root `OverlayPanel` composition | panel/sheet state, presentation-only | root | no squeezed desktop columns/rails; side drawer pattern | Escape closes; non-modal drawer leaves canvas usable | overlay relation | conditional |
| Tablet portrait sheets | `WorkspaceSheet` | `@arq/workspace` sheet state, presentation-only | root bottom-sheet composition | bottom sheet detents, one open primary sheet | system back closes sheet first; full detent receives focus and root becomes inert | currently local `zIndex: 5`, outside named scale; #403 flags migration to #412 | conditional |
| Phone project bar/dock/sheets | `PhoneProjectBar`, `PhoneDock`, `WorkspaceSheet` | responsive + phone-bottom-owner + sheet state; presentation-only | root phone composition | bounded phone UI, no desktop rails/docked columns | system back closes overlay first; one bottom owner at a time | phone shell + sheet overlay | conditional |
| No-project composition | same root shell; host native-project availability/status projections | host/native-project availability; commands carry honest disabled reasons | `App.tsx` -> root + outside-root file open | all bands remain reachable | normal shell/dialog behaviour | normal shell | initial/product state |
| Project-open composition | same root shell with opened project model/session | native project/session + canonical model; shell only projects status | `App.tsx` -> root | same responsive authority, project content replaces no-project status | normal shell/dialog behaviour | normal shell | after open |
| Read-only presentation | same shell + project/file status and disabled command reasons | native open/session authority owns writability; shell projects it | host integration | independent of platform | authoring refusal remains reachable and explicit | normal shell/dialog | state-dependent |
| Loading entry surface | 3D `Suspense` fallback and async file/open flows | transient async state, not project semantics | host/viewport or outside-root flow | available in relevant band | status/dialog semantics | viewport or overlay | 3D code is lazy |
| Error/recovery entry surfaces | `FileOpenPanel`, notice/modal flows, command feedback, recovery status | file/open/recovery systems own outcome; shell only projects it | mostly outside `WorkspaceRoot`, hosted by `App.tsx` | global/transient | modal/dialog contracts where used | shared modal/file-open overlay | transient/on demand |

## 5. Viewport authority and heavy boundaries

`PlanCanvas.tsx` and `ModelCanvas.tsx` are viewport content owners, not outer shell owners.

Exact-head `App.tsx`:

- renders Plan through the normal viewport path;
- lazy-loads `ModelCanvas` with `React.lazy`;
- supplies a `Suspense` status fallback, `Loading the 3D view`;
- keeps shared selection wiring across Plan/3D and shell projections.

The exact-head `benchmark:model-canvas` browser check passed and proves the 3D view is user-reachable through the built app and coordinated with Plan/shared selection. #401/#425 own deeper selection-authority work, so #396 does not create another selection store.

## 6. Responsive composition authority

`packages/workspace/src/responsive.ts` remains the only current responsive-policy authority.

Current classification:

- phone: `< 600px`;
- coarse-pointer tablet portrait: `< 900px` in portrait;
- coarse-pointer tablet landscape: `< 1280px`;
- compact desktop: `< 1200px` when not classified as touch tablet/phone;
- desktop above that.

`packages/workspace/src/panel-layout-state.ts` reconciles dock/overlay presentation and preserves user dock preferences separately from platform-driven touch presentation. Touch bands force project browser/inspector out of layout width rather than squeezing desktop columns into the canvas.

The exact-head real-browser `benchmark:workspace-layout` check passed at all eight declared fixtures: 1920×1080, 1536×864, 1366×768, 1024×768, 1194×834 tablet landscape, 834×1194 tablet portrait, 393×852 phone and 412×915 phone. It verifies expected platform band, positive/protected canvas size, no horizontal document overflow, no rails/docked columns on touch bands, a way to summon panels back, visible direct view switching on docking bands, phone compact current-view control, identifiable active view and no console errors.

## 7. Panel, sheet and back-state evidence

`packages/workspace/src/panel-layout-state.ts` owns panel presentation state for project browser, inspector, review, AI, diagnostics and tasks. Exact-head unit tests passed under `pnpm test` and cover open/close toggling, width bounds, floating-before-squeezing, touch-band closure, compact-desktop overlay policy, preservation of dock preference and restoration after returning from touch bands.

`packages/workspace/src/sheet-state.ts` owns one transient touch sheet at a time. Exact-head unit tests passed and cover:

- one open sheet at a time;
- toggle/swap behaviour;
- peek/half/full detents;
- drag-dismiss rules;
- system back closes an open sheet and is not consumed when none is open;
- phone/tablet detent sizing;
- sheet-to-panel mapping.

### Focus correction from the previous map

The previous map incorrectly claimed `WorkspaceSheet` stores prior focus and restores it on close/unmount.

Exact-head `WorkspaceSheet` does **not** implement previous-focus storage/restoration. Its actual current contract is:

- when a sheet reaches full/modal state, focus is moved to the sheet container;
- Escape invokes the configured close handler;
- `aria-modal` is true only at full detent;
- `WorkspaceRoot` marks the covered shell inert while a full sheet is active.

This correction is evidence-only. #396 does not redesign sheet focus behaviour.

For the shared command/modal boundary, exact-head `benchmark:design-system-dialog` passed in real Chromium and proves focus enters the command palette, repeated Tab stays inside, Escape and outside click close it, and focus returns to the exact trigger.

## 8. Outside-root overlays and layer relationship

`WorkspaceRoot` is not the whole overlay story. Exact-head `App.tsx` also mounts global/transient surfaces outside it, including command palette/shared modal flows, `FileOpenPanel`, command feedback and a small fixed history/debug/status surface.

#403's current audit confirms the named layer vocabulary already includes:

- shell raised: 10;
- context HUD: 90;
- overlay backdrop: 100;
- overlay surface: 110;
- popover: 120;
- toast: 200.

Shared modal infrastructure consumes the named overlay tiers. `WorkspaceSheet` is a known exception with local `zIndex: 5` and a local elevation shadow. That is a #412 migration target, not a reason for #396 to invent a second layer system. The older `--arq-z-modal: 400` compatibility value must not be used for new work without consumer verification.

## 9. Presentation state versus canonical truth

| State/data | Classification | Current authority |
| --- | --- | --- |
| Panel open/collapsed/width | presentation | `@arq/workspace` |
| Touch sheet/drawer open | presentation | `@arq/workspace` |
| Workspace mode/view tab | session/workspace | `@arq/workspace` + host binding |
| Camera/viewport display | view/session | view owner; never renderer object as canonical project data |
| UI selection references | session/presentation refs to canonical IDs | current host/shared path, deeper map in #401/#425 |
| Building elements/geometry | canonical semantic project data | model/operation packages, never shell |
| Native working-copy durability | persistence authority | native project/session persistence, shell projects status only |
| Publish result | publication authority | publication path, shell projects status only |
| Import staging | pre-commit external workflow | adapter/fidelity authority |
| Agent proposal/review | governed Agent authority | Agent system, projected into workspace |

## 10. High-conflict files/interfaces

Treat these as serialised or explicitly coordinated in later work:

1. `apps/web/src/App.tsx`
   - broad host integration;
   - currently owned by PR #361;
   - no #396 mutation.
2. `packages/design-system/src/workspace/workspace-root.tsx`
   - one composition authority across desktop/touch bands.
3. `packages/workspace/src/panel-layout-state.ts`
   - shared panel authority.
4. `packages/workspace/src/responsive.ts`
   - single responsive/docking authority.
5. `packages/workspace/src/sheet-state.ts`
   - one-at-a-time touch-sheet authority.
6. `packages/design-system/src/shell/**` and `packages/design-system/src/workspace/**`
   - shared shell primitives with cross-surface blast radius.
7. shared selection/command/tool interfaces
   - #398/#401 and later UX-2 work own deeper authority; shell lanes must not fork them.

## 11. Duplicate / legacy candidates

`packages/design-system/src/shell/index.ts` still exports prototype `ipad-landscape-shell` and `ipad-portrait-shell` compositions.

The exact current host path uses `WorkspaceRoot`, `TabletDrawerBar`, `WorkspaceSheet`, `PhoneDock` and `PhoneProjectBar` instead. The older iPad shell compositions are therefore **library-only / legacy candidates**, not a second current product-shell authority and not falsely declared dead code. Any deletion still requires a full consumer search in the cleanup lane.

No current open PR introduces a second product workspace root, panel-state store, responsive authority or phone/tablet navigation authority.

## 12. Executable evidence at the audited runtime head

GitHub Actions run `34780753269` executed against exact `main` SHA `14d333a225d6b606a8693f85246cacadb1c93ce3`.

Verified relevant evidence:

- `pnpm test` — **PASS**. Includes responsive, panel-layout, sheet/back, view-tab, tool, mode, browser-panel and other workspace state tests.
- `browser-capability-checks` — **PASS** in real headless Chromium against production builds.
- `benchmark:workspace-layout` — **PASS** across eight desktop/tablet/phone fixtures, including no horizontal overflow and reachable panels.
- `benchmark:design-system-dialog` — **PASS** for focus entry, trap, close paths and focus return.
- `benchmark:model-canvas` — **PASS** for user-reachable 3D and Plan/3D coordination.
- `benchmark:wall-hud` — **PASS** for the current Context HUD interaction/escape contract.
- `benchmark:file-open` — **PASS** for the user-reachable file-open UI.
- `benchmark:journal-recovery` — **PASS** for browser journal recovery after reload.
- `benchmark:native-open` — **PASS** through the built app: a real `.arq` fixture reaches the workspace, Plan renders, 3D shares canonical IDs/selection, working-copy status stays honest, workers are released and selected source bytes are unchanged.
- `benchmark:e2e-arq-open` — **PASS** for valid/read-only/older-reader/foreign-file Worker open outcomes.

Representative requirements from the closure prompt are therefore covered as follows:

| Required proof | Evidence |
| --- | --- |
| desktop composition | `benchmark:workspace-layout` desktop fixtures |
| tablet composition | `benchmark:workspace-layout` landscape + portrait fixtures |
| phone composition | `benchmark:workspace-layout` iPhone + Android fixtures |
| panel open/collapse | exact-head `panel-layout-state.test.ts` under passing `pnpm test`; browser layout additionally proves touch panel summon controls |
| modal/focus boundary | `benchmark:design-system-dialog`; full `WorkspaceSheet` inert/focus/back contract additionally mapped from exact-head source/state tests |
| no unintended horizontal overflow | `benchmark:workspace-layout` |
| Plan and 3D remain usable | `benchmark:model-canvas` + `benchmark:native-open` |
| no-project vs project-open remain distinguishable | no-project shell/status in default workspace layout + real project adoption/name/revision in `benchmark:native-open` |
| read-only/open outcomes | `benchmark:e2e-arq-open` and native-open integration path |
| loading/error/recovery entry surfaces | 3D `Suspense` loading surface + file-open/e2e outcomes + `benchmark:journal-recovery` |

The overall CI workflow run is red because the separate `lint-and-typecheck` job failed at pre-existing `pnpm format:check`; subsequent lint/typecheck/workspace-registry/ZEUS steps in that job were skipped. The focused unit and browser jobs above completed successfully and are the evidence relied on by #396. This audit does not claim the unrelated overall CI state is green.

The requested local ZEUS compile command could not be executed in this ChatGPT execution environment because no repository checkout/browser-capable local runner is available here. No ZEUS result is fabricated. Existing exact-head CI also did not reach the ZEUS validation steps because its format step failed. This is recorded as non-#396 repository evidence debt, not silently converted into a pass.

## 13. Exact-head acceptance status for #396

Issue acceptance criteria are satisfied at the audited runtime head:

- [x] every shell region has one current owner;
- [x] high-conflict files/globs are listed;
- [x] duplicate/legacy paths are identified without overclaiming dead code;
- [x] responsive compositions are mapped to one current policy authority;
- [x] later UX-1 issues can state exactly which current authority they extend;
- [x] repository-visible map is tied to the exact runtime head and focused existing browser/unit evidence.

No ownership contradiction from current #403 or #493 changes the shell authority recorded here. #403 adds a layer finding: `WorkspaceSheet` is a known local-z-index exception to the existing named layer vocabulary.

## 14. Safe downstream lanes and serialisation boundary

This audit removes **#396 ownership-map uncertainty**. It does not remove other issue dependencies.

Safe, ownership-bounded downstream preparation/implementation:

- **#409 panel behaviour** can extend `@arq/workspace` panel-layout authority without creating a new store, provided its own dependencies are satisfied and it avoids live root conflicts.
- **#412 overlay-zone work** can build on #403's named layer inventory and this map's outside-root overlay inventory, while preserving the shared modal authority.
- reusable leaf shell/workspace primitives that avoid `App.tsx` may proceed when their own issue dependencies/claims permit.

Still serialised or dependency-gated:

- **#407 root desktop shell integration** must not edit `App.tsx` while PR #361 owns it and must respect #403/#493/CTO sequencing.
- **#414 tablet** and **#416 phone** should follow the established panel/overlay contracts and their declared dependencies rather than fork responsive logic.
- **#418 root integration portions** remain conflict-prone around `App.tsx`/`WorkspaceRoot`; leaf primitives may be separable if explicitly claimed.
- **#420** remains gated by #398 command authority.
- **#425** remains gated by #401 selection authority.

## 15. ZEUS/CTO handoff

#369 should reject any later change that introduces:

- a second `WorkspaceRoot`-equivalent product shell;
- local panel width/open stores bypassing `@arq/workspace`;
- tablet/phone layouts that squeeze desktop columns instead of using the existing responsive authority;
- shell controls that become canonical project-data owners;
- duplicated selection/command authority;
- arbitrary z-index escalation outside #403/#412;
- `App.tsx` edits that overwrite PR #361 or another live owner without explicit reconciliation.

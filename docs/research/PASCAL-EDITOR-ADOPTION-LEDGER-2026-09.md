# Pascal Editor adoption ledger

**ARQ issue:** #405  
**ARQ programme:** #377 / UX-0 #379  
**Reviewed ARQ integration head:** `e292d3c50aa19e8105c29662ed21a3bb739ac225` (`main`, 2026-09-13)  
**Reference repository:** `pascalorg/editor`  
**Pinned Pascal revision:** `5275f3e657c21dcd363e3b08e01c97789fc55079` (2026-09-12)  
**Licence at pinned revision:** MIT, Copyright (c) 2026 Pascal Group Inc.  
**Related research:** PR #366 owns the separate Archaiflow research files and is not modified by this ledger.

This document is a routing and provenance aid. It does not make Pascal architecture authoritative for ARQ. Accepted ARQ ADRs, project-format/operation/persistence contracts, issue ownership and exact-head executable evidence remain stronger sources of truth.

## Classification vocabulary

- **ADOPT**: the product/interaction idea fits ARQ and can be implemented using ARQ-native contracts.
- **ADAPT**: the idea is valuable, but its state model, accessibility, persistence, units, renderer or permission assumptions must be changed for ARQ.
- **REFERENCE ONLY**: study implementation/reliability techniques, but do not treat the referenced implementation as an ARQ product contract.
- **REJECT AS ARQ FOUNDATION**: do not replace an ARQ architectural authority with the Pascal mechanism without a separate architecture decision.

## Licence and provenance boundary

Pascal's repository root licence at the pinned revision is MIT. The licence permits use, modification, merge, publication, distribution, sublicensing and sale, provided the copyright and permission notice are retained in copies or substantial portions of the software.

For ARQ:

1. Interaction ideas and independently reimplemented patterns do not require copying Pascal source.
2. If a future lane copies or substantially derives Pascal source, that lane must preserve the applicable MIT notice in the repository's third-party notices/licence mechanism and identify the exact Pascal revision and source path in its PR.
3. Do not assume separately bundled models, textures, sample projects, fonts, catalogue assets or other third-party assets inherit the repository MIT licence. Verify each asset's provenance before reuse.
4. #405 itself copies no Pascal runtime source and adds no Pascal dependency.

## Adoption ledger

| Pascal idea | Classification | Pascal source at pinned revision | ARQ target / owner | Required ARQ adaptation and acceptance evidence |
| --- | --- | --- | --- | --- |
| Canvas-first desktop editor composition | **ADOPT** | `packages/editor/src/components/editor/editor-layout-v2.tsx` | UX-1 #407, #409 | Keep ARQ `WorkspaceRoot`/`@arq/workspace` authority. Increase drawing/model dominance and make secondary chrome collapsible without creating a second shell. Browser evidence at supported desktop widths. |
| Single icon rail + resizable/collapsible secondary panel | **ADAPT** | `packages/editor/src/components/editor/editor-layout-v2.tsx` | #407, #409 | Use existing ARQ rails/panels, shell tokens and presentation reducers. Preserve keyboard focus, reopen state and touch policies. No Pascal layout state/store import. |
| Canvas-local floating control groups | **ADOPT** | `packages/editor/src/components/editor/editor-layout-v2.tsx`; `packages/editor/src/components/ui/action-menu/**` | #412, #418 | Fit ARQ overlay-zone/z-index contract. Floating controls may use bounded material treatment, but project truth/inspectors remain solid. Prove no drawing occlusion or overlay collisions. |
| Mobile viewer + draggable bottom sheet with detents | **ADAPT** | `packages/editor/src/components/editor/editor-layout-mobile.tsx` | #414, #416 | ARQ already owns `WorkspaceSheet` and platform layout policy. Borrow the viewer-first interaction model, not Pascal state. Preserve keyboard/switch paths, touch targets, Pencil use and ARQ full-sheet focus rules. |
| Compact floor/storey selector with rename/reorder/height/duplicate/add/delete | **ADAPT** | `packages/editor/src/components/ui/floating-level-selector.tsx`; `packages/editor/src/components/ui/level-duplicate-dialog.tsx` | #451, #454, #455 | UI is valuable, but level semantics/mutations must come from ARQ level/domain owners. Never let UI-local state become model authority. Typed operations, validation, undo grouping and persistence required. |
| Context-sensitive action grouping instead of always-visible tool chrome | **ADOPT** | `packages/editor/src/components/ui/action-menu/**` | #423, #427, #418 | Derive actions from ARQ command/tool capability metadata and current selection/tool context. Disabled actions require explicit reasons. |
| Command palette as a first-class invocation surface | **ADAPT** | `packages/editor/src/components/ui/command-palette/index.tsx` | #420, #423 | ARQ already has an accessible command palette. Extend canonical command metadata/reachability rather than replacing it. Every palette action must invoke the same command path as toolbar/menu/shortcut equivalents. |
| Context menu primitive and contextual invocation | **ADAPT** | `packages/editor/src/components/ui/primitives/context-menu.tsx` | #423, #429 | Use ARQ focus restoration, keyboard navigation and command metadata. No separate command implementation inside menus. |
| Registry-driven node/tool/plugin contributions | **ADAPT** | `packages/core/src/registry/registry.ts`; `packages/core/src/registry/types.ts` | #420, #427 and later extensibility work | Valuable as a contribution-model reference. ARQ contributions must resolve to ARQ semantic commands/typed operations and cannot register a competing canonical model, history or persistence authority. A future plugin API needs its own ADR/security contract. |
| Lazy loading/preloading of tool modules and affordances | **ADAPT** | `packages/editor/src/components/tools/tool-manager.tsx` | #420, #427, #489 | Use only after ARQ's canonical command/tool contract is stable. Lazy boundaries must not change command availability truth and must expose loading/failure states. Measure bundle/startup deltas. |
| Direct manipulation lifecycle: hover/candidate/preview/snap/commit | **ADOPT** | `packages/editor/src/components/tools/tool-manager.tsx`; `packages/editor/src/components/tools/wall/wall-drafting.ts` | #427, #431-#447, #457-#458 | Standardise the interaction vocabulary across Plan and 3D: cursor → preview → candidate snaps → chosen snap → typed input where applicable → validation → atomic commit → one undo step. Use ARQ geometry/operation/tolerance authorities rather than Pascal algorithms. |
| Wall snap feedback and drafting ergonomics | **REFERENCE ONLY** | `packages/editor/src/components/tools/wall/wall-drafting.ts` | #431, #433, #435; semantic owner #378; tolerance #464 | Study UX cues, endpoint/body/intersection feedback and atomic-history intent. Do not copy Pascal metre/grid assumptions or wall mutation algorithms. ARQ semantic wall mutation remains authoritative. |
| Broad built-in architectural node catalogue | **REFERENCE ONLY** | `packages/nodes/**`; schemas/registry in `packages/core/**` | future element/catalogue work | Useful coverage checklist only. ARQ should not chase breadth before Release-1 wall/opening/room/dimension/3D/sheet/PDF/recovery vertical slices are trustworthy. |
| Item/furniture catalogue UX | **REFERENCE ONLY** | `packages/editor/src/components/ui/item-catalog/**` | post-Core catalogue/furnishing work | Defer until core architectural authoring and persistence are complete. Asset provenance, search performance and project-size budgets require separate work. |
| WebGPU/R3F renderer stack | **REFERENCE ONLY** | `packages/viewer/src/components/viewer/index.tsx` | renderer/performance owners, #402/#488/#489 | Study GPU loss/error handling, frame limiting, pause controls, resource readiness and async renderer guards. ARQ currently has a functioning WebGL2 path; renderer migration requires benchmark/evidence and a dedicated ADR/issue. |
| GPU device-loss and renderer-failure resilience | **ADAPT** | `packages/viewer/src/components/viewer/index.tsx` | #488, #490 | Bring equivalent failure visibility/recovery expectations to ARQ's renderer stack without changing renderer authority. Exact weak-GPU/device-loss evidence required. |
| Separate scene/editor stores using Zustand/Zundo | **REJECT AS ARQ FOUNDATION** | `packages/core/src/store/use-scene.ts` and related editor/viewer stores | none without future ADR | ARQ's semantic project, typed operations, undo grouping, `.arq` persistence/recovery and cross-surface projection are existing authorities. Do not replace them with Pascal scene state or history. |
| Pascal flat node graph as canonical project model | **REJECT AS ARQ FOUNDATION** | `packages/core/src/store/use-scene.ts`; core schemas | none without future ADR | Would create competing model identity and flatten ARQ semantic/persistence work. Renderer/tree projections may borrow UI ideas only. |
| Pascal coordinate/unit assumptions (generally level-local metres) | **REJECT AS ARQ DECISION** | registry/geometry/tool contracts including `packages/core/src/registry/types.ts` and wall drafting | #88 + #452 + geometry owners | ARQ canonical units/numeric representation remain unresolved in #88. No Pascal metre assumption may settle that issue implicitly. Display/input round-trip must be solved intentionally. |
| Local MCP service operating directly against Pascal scene storage | **REFERENCE ONLY** | `packages/mcp/**` and MCP documentation | #419/#421/#422/#424/#428 | Useful live-update/event-stream reference. ARQ must preserve grants, scopes, expiry/revocation, review boundaries, canonical operation validation and project permissions. MCP cannot become a bypass around ARQ mutation/persistence authority. |
| Agent changes appearing live in the local editor | **ADAPT** | Pascal MCP/editor scene event flow | #477-#483 plus Agent domain owners | Desired ARQ form: agent proposes semantic operations → ARQ validates → preview/highlight appears → Review Centre explains assumptions/diff → governed approval if required → canonical operation/persistence path commits → result/undo truth remains visible. |
| AI failure/interruption handling | **ADOPT AS FAILURE REQUIREMENT** | Pascal issue #594 documents silent failed streams/partial-apply ambiguity | #481 | ARQ must always state failure cause, whether anything applied, retry/recovery affordance and durable/undo outcome. Never show silence after partial application. |
| Local asset URLs/storage without complete lifecycle ownership | **REJECT AS STORAGE PATTERN** | Pascal issue #733 records orphanable local asset behaviour | file/persistence/security owners | Any ARQ asset system must have project identity, reference counting/cleanup, persistence and export semantics before use. Do not bolt browser object URLs onto project state. |
| First-class north direction/viewport compass gap | **REFERENCE ONLY / CHECKLIST** | Pascal issue #362 | future drawing/navigation owner | Record as a domain requirement candidate, not something to copy. Must derive from ARQ project/view semantics if introduced. |
| Pascal import wishes for AutoCAD/Sweet Home 3D | **REFERENCE ONLY** | Pascal issues #158/#174 | #410/#415 and format-specific owners | Useful demand signal only. ARQ exchange formats need fidelity contracts, staging, validation and untrusted-file boundaries. |

## Explicit foundation boundaries

The following Pascal systems are **not** authorised ARQ replacements by this ledger:

- Pascal scene schemas/node graph as canonical project state;
- Zustand scene/editor/viewer stores as canonical state authority;
- Zundo as ARQ's canonical undo/redo authority;
- Pascal IndexedDB/SQLite/local-scene persistence as `.arq` authority;
- direct MCP mutation of backing storage without ARQ operation validation/review;
- Pascal metre/grid defaults as ARQ unit/numeric policy;
- Three.js WebGPU/R3F as an automatic replacement for the current ARQ renderer;
- Pascal catalogue breadth as a Release-1 scope requirement.

Any lane that needs to cross one of those boundaries must stop and open or cite a dedicated architecture decision. #369 should treat an uncited boundary crossing as integration drift.

## ARQ interaction principles extracted from Pascal

The following are safe product-level principles to carry forward because they can be implemented on ARQ-native foundations:

1. **Canvas first.** The drawing/model is primary; chrome should be collapsible, contextual and spatially economical.
2. **Relevant tool second.** Show the active tool and immediate choices near the work rather than presenting every capability simultaneously.
3. **Properties/context third.** Inspector content follows canonical selection and the active operation, not a parallel UI selection store.
4. **Project navigation fourth.** Levels/tree/views remain reachable without consuming permanent drawing area.
5. **Global controls last.** File/account/general commands should not visually compete with authoring.
6. **One interaction lifecycle.** Preview, snapping, numeric entry, validation, commit and undo grouping should feel consistent across elements and surfaces.
7. **One command truth.** Toolbar, context menu, palette and shortcuts are invocation surfaces for the same canonical command.
8. **Responsive composition, not scaled desktop.** Phone/tablet rearrange the same authorities rather than cloning state into a second app shell.

## Known Pascal debt ARQ should not inherit

- Pascal issue #308 reports a display/input unit mismatch, reinforcing the requirement that #88 be solved deliberately before ARQ claims robust unit-aware numeric authoring.
- Pascal issue #594 reports AI stream failure with no visible error/retry/partial-apply truth, reinforcing #481's failure-state contract.
- Pascal issue #733 reports local asset lifecycle/orphaning risk, reinforcing ARQ's requirement that storage/persistence own resource lifecycle.
- External feature requests such as north direction, additional imports and additional MEP tools are useful coverage signals, not reasons to expand ARQ Core scope prematurely.

## Routing to ARQ programme

### UX-1
Use Pascal primarily as a composition reference for #407/#409/#412/#414/#416. Extend existing ARQ shell primitives. Do not introduce a second shell or Pascal layout state.

### UX-2
Use the contextual-action, command-palette and tool-manager ideas to strengthen #420/#423/#427/#429. #398's reachability audit remains the ARQ evidence source for which commands are actually product-reachable.

### UX-3 / UX-4
Use direct-manipulation and level-selector ideas in #431-#458 only after their semantic/domain dependencies are explicit through #493. UI issues do not own wall/opening/room/level canonical mutations by default.

### UX-7
Use Pascal's local MCP live-update model only as a feedback/eventing reference. ARQ's governed Agent/Review Centre model remains stricter and authoritative.

### UX-8
Use Pascal renderer resilience techniques as test/reference material for #488/#489/#490, not as justification for a renderer rewrite.

## Acceptance checklist for later Pascal-derived work

Before merging a Pascal-inspired ARQ change, the implementing issue/PR should answer:

- Which ledger row is being used?
- Is the row ADOPT, ADAPT, REFERENCE ONLY or REJECT AS ARQ FOUNDATION?
- What ARQ authority owns the resulting state/mutation?
- Is any Pascal source copied or substantially derived? If yes, where is MIT attribution recorded?
- Does the change settle an unresolved ARQ architecture/unit/security decision by accident?
- Are keyboard, touch/Pencil, reduced-motion and responsive states covered where applicable?
- Does it preserve `.arq`, typed-operation, undo/redo, validation, recovery and permission boundaries?
- What exact-head browser/performance/accessibility evidence proves the user-facing result?

If those answers are not explicit, the lane is not ready to claim Pascal-derived implementation complete.

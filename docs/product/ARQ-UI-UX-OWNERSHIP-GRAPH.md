# ARQ UI/UX semantic ownership and dependency graph

**Programme:** #377  
**Graph reconciler:** #493  
**CTO reconciler:** #369  
**Issue contract:** #368  
**Ownership protocol:** #317 / #319  
**Status:** initial live graph, requires refresh whenever overlapping domain issues or active PR ownership changes

## Authority rule

This graph coordinates work. It does not define product truth. Live code, accepted ADRs, package/file-format contracts and exact-head evidence outrank it.

Until #317/#319 enforcement lands, an open PR is a legacy owner of the files/interfaces it actually changes. Different issue numbers do not make overlapping paths safe to edit concurrently.

## Current branch/PR transition

Repository default remains `claude/arq-cad-platform-research-ba8rav`, while current open PRs target `main`. #332 owns canonical branch authority. Every agent must discover the actual current integration authority instead of assuming either branch.

Current live PR path reservations from preflight:

| PR | Purpose | Live paths relevant to programme |
| --- | --- | --- |
| #361 | native editor persistence | `apps/web/src/App.tsx`, `apps/web/src/project/native-project-session*`, `apps/web/src/project/workspace-persistence*` |
| #362 | browser/device matrix docs | validation matrix/evidence docs |
| #363 | browser-engine smoke | browser matrix workflow/script/docs |
| #365 | ZEUS cross-language graph | `.zeus/repository-graph.json`, ZEUS scripts/workflow |
| #366 | Archaiflow research | `docs/research/ARCHAIFLOW-REFERENCE-2026-09.md`, `docs/research/COMPETITOR-WORKFLOW-AUDIT.md` |

## Ownership semantics

- **Domain owner:** owns canonical model, operation, persistence, security or release semantics.
- **UI integration owner:** exposes/refines an already-governed capability through the product UI.
- **Evidence/reconciliation owner:** proves cross-lane behaviour; does not create another implementation authority.
- **Decision dependency:** must be resolved separately and cannot be decided incidentally by a UI issue.

## UX-0 discovery and routing

| UI/UX issue | Role | Notes |
| --- | --- | --- |
| #396 | evidence/reconciliation | shell/shared-file ownership map; inspect `App.tsx` but do not mutate while #361 active |
| #398 | evidence/reconciliation | command/tool reachability; feed #370 rather than creating second capability ledger |
| #401 | evidence/reconciliation | selection/focus authority map; consume/coordinate #389 later |
| #403 | evidence/reconciliation | token/local-constant/layer audit; no broad migration yet |
| #405 | research/evidence | Pascal reference/licence ledger; avoid PR #366 research files |
| #493 | graph authority for routing only | classify overlaps, dependencies, parallel safety; no product runtime mutation |

## UX-1 shell

| UI/UX issue | Domain/authority dependency | Classification |
| --- | --- | --- |
| #407 desktop shell | #396, #403; active PR #361 on `App.tsx` | UI integration, serialised root-shell lane |
| #409 panel behaviour | #396/#403 | UI integration |
| #412 overlay/layer contract | #403 | UI integration/design-system contract |
| #414 tablet composition | #396/#409/#412, #359 physical evidence | UI integration + later human/device evidence |
| #416 phone composition | #396/#409/#412 | UI integration |
| #418 shell state vocabulary | #396/#403, language authority | UI integration primitive |

## UX-2 commands, selection and tool lifecycle

| UI/UX issue | Domain/authority dependency | Classification |
| --- | --- | --- |
| #420 command metadata/dispatch | current command system; canonical operation owners | shared UI/command infrastructure owner |
| #423 palette/context menus | #420 | UI integration |
| #425 selection semantics | #401, #389 | UI/session-state integration; no canonical model ownership |
| #427 active-tool HUD/lifecycle | #420/#412, existing editor-shell tool state | UI/editor interaction infrastructure |
| #429 shortcuts/focus | #420/#427, #400 later | UI/accessibility integration |

## UX-3 plan-authoring slices

### Walls

- **Domain owner:** #378 production wall editing, joins and semantic dependency handling.
- **Persistence dependencies:** #355 and #356 as applicable.
- **Decision/robustness dependencies:** #88 canonical units and #464 tolerance ladder where relevant.
- **UI slices:**
  - #431 wall drafting snap/preview/commit feedback
  - #433 exact wall length/angle entry
  - #435 direct wall reshape handles/atomic undo

Rule: #431/#433/#435 may refine interaction and product wiring but must not create a second wall semantic operation, snapping authority or dependency policy.

### Doors and windows

- **Domain owner:** #380 hosted openings, doors and windows.
- **UI slices:** #437 door placement, #439 door handing/swing editing, #441 window placement/size/sill editing.

Rule: host identity, collision/clearance rules, dependency handling and persistent door/window semantics belong to #380. UI issues consume those operations.

### Rooms

- **Domain owner:** #382 room detection, semantic identity, area and gap diagnostics.
- **UI slice:** #443.

Rule: boundary graph, canonical room identity and area authority stay in #382. #443 owns discoverability, preview/error/inspection UX.

### Dimensions

- **Domain owner:** #385 associative dimensions.
- **Reference contract:** #465 semantic subreferences.
- **Decision dependencies:** #88/#464 as applicable.
- **UI slice:** #445.

Rule: #445 must not bind dimensions to display names/nearest geometry or invent its own reference system.

### Notes

- **Domain owner:** #387 durable text notes.
- **UI slice:** #447.

Rule: #447 owns editing interaction/focus/placement experience, not a second note entity/persistence model.

### Inspector numeric editing

- **Domain/product owner:** #391 production browser/inspector.
- **Formatting/decision dependencies:** #88, #452.
- **UI slice:** #449 reusable numeric editing contract.

Rule: #449 may own reusable input behaviour but field semantics and editable/read-only domain properties remain governed by their semantic owners.

## UX-4 levels, browser and 3D

- **Cross-surface canonical/derived-state owner:** #389.
- **Browser/inspector product owner:** #391.
- **UI slices:** #451 level selector, #454 level CRUD UI when canonical operations exist, #455 visibility/isolation, #456 browser hierarchy/performance, #457 camera/view controls, #458 safe 3D editing/Plan hand-off.

Rules:
- View visibility/camera state never becomes canonical project data.
- #454 may expose level mutations only after a canonical level operation/dependency policy exists.
- #458 can expose only operations that map exactly to existing canonical operations and must hand off unsupported edits to Plan.

## UX-5 durability, files and exchange

### Native working-copy persistence and Publish

- **Persistence bridge:** #355.
- **Lossless rich/reference mutation:** #356.
- **Publication lifecycle authority:** #371.
- **UI slices:** #459 durability state model, #460 persistence acknowledgement integration, #461 open/migrate/load states, #462 recovery UX, #463 read-only/safe mode, #469 Publish/download-copy UX.

Rules:
- UI never marks durable state before authoritative acknowledgement.
- No UI issue creates a second save queue/publication path.
- Demo journal and native working copy are distinct authorities.

### External import/export

- **P2 exchange authority:** #410.
- **DXF adapter:** #411.
- **IFC adapter:** #413.
- **Shared fidelity/staging contract:** #415.
- **Untrusted file boundary:** #446.
- **UI slices:** #466 import staging/review, #471 external export fidelity/delivery.

Rule: common fidelity semantics come from #415 and actual adapter job results, never UI inference.

## UX-6 sheets and PDF

- **Sheet/document owner:** #393.
- **Scaled vector PDF owner:** #395.
- **Protected Core E2E gate:** #406.
- **UI slices:** #472 navigation/context, #473 viewport arrangement, #474 paper/scale controls, #475 PDF preflight/result UX.
- **Evidence slice:** #476 protected UI/UX workflow proof.

Rule: sheet viewports reference canonical views/project state; UI must not copy building geometry into document state.

## UX-7 Agent and Review Centre

- **P3 epic:** #419.
- **Read-only governed host:** #421.
- **Proposal object/Review Centre foundation:** #422.
- **Governed apply/persistence/grouped undo:** #424.
- **Eval/red-team authority:** #428.
- **Diagnostics/privacy:** #448 where applicable.
- **UI slices:** #477-#483.

Rules:
- UI does not gain direct model-write authority.
- Approve applies the exact reviewed typed operation group through #424.
- Grant/permission state comes from the governed Agent boundary, never local booleans.
- Provenance UI is a read-only projection, not a second history store.

## UX-8 final quality/evidence

| UI/UX issue | Existing authority consumed | Role |
| --- | --- | --- |
| #484 | #400 accessibility/keyboard | final accessibility reconciliation |
| #485 | #359 physical Safari/iPad/Pencil | physical input evidence reconciliation |
| #486 | #403 + final UI | motion/reduced-motion hardening |
| #487 | visual test infrastructure | visual-regression evidence |
| #488 | #358/#360 + 3D renderer | failure/fallback UX proof |
| #489 | #402 performance budgets | final UI performance reconciliation |
| #490 | lifecycle/session owners | resource-leak stress evidence |
| #491 | #404 contextual help | final help/shortcut drift reconciliation |
| #492 | #476 + all final gates + #369 | final programme acceptance |

## Current safe frontier

### Safe to start now as audit/metadata/research lanes

- #396
- #398
- #401
- #403
- #405
- #493

### Not safe to start as broad runtime mutation yet

- #407 and any other root-shell lane touching `apps/web/src/App.tsx`, because PR #361 currently owns that file.
- UX-3 semantic operations until #493 has confirmed which work remains in UI slices versus #378/#380/#382/#385/#387.
- UX-5 persistence/publication UI until #355/#356/#371 current state is re-read at implementation time.
- UX-7 mutation UX until #421/#422/#424 contracts are implemented/current.

## Reconciliation trigger

Run #369 after 3–5 merged UI/UX implementation lanes, before every phase gate, after changes to command/selection/operation/persistence authority, or immediately when a cross-lane regression/ownership conflict appears.

#493 must refresh this graph whenever new overlapping domain issues are created or existing issue contracts materially change.

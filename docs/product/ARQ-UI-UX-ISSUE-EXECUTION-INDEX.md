# ARQ UI/UX issue execution index

**Status:** live routing index for the UI/UX programme  
**Programme:** #377  
**Plan:** `docs/product/ARQ-UI-UX-MASTER-EXECUTION-PLAN-v1.0.md`  
**Universal programme:** #367  
**Issue-contract authority:** #368  
**Recurring CTO reconciler:** #369  
**Ownership protocol:** #317 / #319  
**Graph reconciliation:** #493

This index is a routing aid, not a replacement for live GitHub issue state. Agents must read the actual issue, current repository instructions, active PRs and current integration authority before editing. If this file and live issue/repository evidence disagree, live evidence wins and this file must be updated.

## Operating model

1. Individual implementation agents work from one bounded child issue.
2. The child issue is the work ledger. The agent posts branch/head, claimed files/interfaces, changed assumptions, evidence, blockers and follow-ups at meaningful checkpoints.
3. Different issue numbers do not imply safe parallelism. Shared root files and canonical operation/persistence authorities require one active owner or explicit sequencing.
4. Semantic/domain programme issues own canonical data, operations, persistence and safety policy. UI/UX child issues integrate, expose, refine and prove those capabilities unless their body explicitly owns a domain change.
5. #369 is the recurring original/CTO lane. Run it after roughly 3–5 merged UI/UX lanes, before every phase gate, after a cross-cutting contract change, or when cross-lane regression appears.
6. #493 continuously reconciles this UI/UX graph against new P1/P2/P3 issues so agents do not implement the same capability twice.

## Phase epics

| Phase | Epic | Outcome                                                         |
| ----- | ---- | --------------------------------------------------------------- |
| UX-0  | #379 | Inventory, authority and interaction-contract freeze            |
| UX-1  | #381 | Canvas-first shell and visual hierarchy                         |
| UX-2  | #383 | Commands, selection and contextual interaction unification      |
| UX-3  | #384 | Release-1 plan authoring UX completion                          |
| UX-4  | #386 | Levels, project browser and coordinated 3D UX                   |
| UX-5  | #388 | File, persistence, import/export and recovery UX                |
| UX-6  | #390 | Sheet/document workflow UX                                      |
| UX-7  | #392 | Inspectable Agent/Review Centre UX                              |
| UX-8  | #394 | Accessibility, resilience, responsive and performance hardening |

## UX-0: ready discovery/routing lanes

- #396 shell/panel/overlay/shared-file ownership audit
- #398 command/tool/capability reachability audit
- #401 selection/focus/interaction-state authority audit
- #403 design-token/local-constant/overlay-layer audit
- #405 Pascal adoption/licence/provenance ledger
- #493 UI/UX ↔ universal-programme issue-graph reconciliation

These are the safest initial parallel lanes because they are primarily audit/metadata work. They must inspect active PRs and avoid runtime implementation except for bounded evidence tooling.

## UX-1: shell

- #407 desktop canvas-first shell
- #409 panel collapse/resize/docking/reopen contract
- #412 overlay zones/floating controls/z-index contract
- #414 tablet touch/Pencil-first composition
- #416 phone review/light-edit composition
- #418 shell empty/loading/disabled/read-only/error states

Do not start broad UX-1 root-shell work until #396/#403 and #493 provide current ownership/dependency evidence. `apps/web/src/App.tsx` and shared workspace state are serialised resources.

## UX-2: interaction language

- #420 canonical command metadata/dispatch
- #423 command palette/context menus/disabled reasons
- #425 unified selection/multi-selection/primary selection
- #427 canonical active-tool HUD/lifecycle
- #429 keyboard shortcuts/Escape/back/focus restoration

## UX-3: plan authoring UI slices

- #431 wall drafting snap/preview/commit feedback
- #433 exact wall length/angle input
- #435 direct wall reshape/atomic undo
- #437 door placement/host preview
- #439 door hand/side/swing editing
- #441 window placement/size/sill editing
- #443 room bounded/unbounded/inspection workflow
- #445 dimension placement/editing interaction
- #447 text note placement/in-place editing
- #449 inspector numeric editing/units/validation/mixed values

### Semantic/domain owners that must be reconciled before agents start these UI slices

- #378 production wall editing, joins and dependency handling
- #380 hosted openings/doors/windows
- #382 rooms/area/gap diagnostics
- #385 associative linear dimensions
- #387 durable text notes
- #389 canonical model coordination/invalidation
- #391 production browser/inspector
- #88 canonical numeric/unit representation decision
- #464 geometry tolerance/robustness contract
- #465 stable semantic reference/subreference contract
- #452 locale/unit display policy where applicable

#493 must mark each UI slice as a dependent integration/polish lane or narrow/merge it if the semantic owner already includes the identical implementation work.

## UX-4: project navigation and 3D

- #451 compact storey/level selector
- #454 safe level create/rename/duplicate/delete
- #455 level visibility/isolation/context
- #456 project browser hierarchy/selection/performance
- #457 3D camera/fit/reset/selection coordination
- #458 safe direct 3D edits + Plan hand-off

Coordinate all cross-surface work with #389 and browser/inspector work with #391. 3D renderer objects are never canonical project state.

## UX-5: file, durability and exchange UX

- #459 canonical durability/project-file state model
- #460 persistence acknowledgements → durability UI
- #461 open/hydrate/migrate/load-failure states
- #462 recovery review/restore/discard UX
- #463 read-only/safe-mode behaviour
- #466 universal import fidelity/staging UI
- #469 canonical native Publish/download-copy UX
- #471 external export fidelity/delivery UX

### Domain owners

- #371 canonical native save/Publish/export authority
- #355 live editor persistence bridge
- #356 lossless semantic mutation for reference-format projects
- #410 P2 exchange epic
- #411 DXF exchange
- #413 IFC federation
- #415 universal import/export fidelity contract
- #446 untrusted import/plugin boundary where applicable

## UX-6: sheet/document UX

- #472 sheet surface navigation/workspace context
- #473 viewport selection/placement/arrangement
- #474 paper + viewport scale controls
- #475 PDF preflight/progress/result UX
- #476 complete protected UI/UX workflow proof

### Domain/release owners

- #393 durable plan sheet and semantic viewport
- #395 scaled vector PDF
- #406 protected Core 1.0 end-to-end release harness

UI issues consume these authorities rather than creating parallel sheet/PDF implementations.

## UX-7: Agent / Review Centre UX

- #477 Agent surface in workspace
- #478 proposal diff/assumptions/validation presentation
- #479 affected-object preview/highlight
- #480 governed Approve/Reject/result/Undo UX
- #481 transport/interruption/partial-outcome truth
- #482 connection/grant/expiry/context status
- #483 provenance/evidence history projection

### Agent domain owners

- #419 P3 Agent epic
- #421 governed read-only Agent host
- #422 typed proposal object + Review Centre foundation
- #424 governed proposal apply/persistence/grouped undo
- #428 Agent evaluation/red-team evidence
- #448 diagnostics/privacy where applicable

No UI Agent lane may create a second mutation, permission, persistence or provenance authority.

## UX-8: final quality/evidence

- #484 final accessibility/keyboard reconciliation using #400
- #485 touch/Pencil parity using #359 physical evidence
- #486 reduced-motion/motion-token enforcement
- #487 visual-regression matrix
- #488 weak-GPU/renderer failure fallback UX
- #489 UI latency/bundle budget reconciliation using #402
- #490 repeated open/close/resource-leak stress evidence
- #491 first-run/help/shortcut reconciliation using #404
- #492 final UI/UX programme acceptance + CTO handoff

### Existing gate owners

- #358 browser matrix
- #359 physical Safari/iPad/Pencil evidence
- #360 Firefox/support-boundary work
- #400 Core accessibility/keyboard gate
- #402 Core workflow performance budgets
- #404 first-run/contextual help
- #408 controlled architect alpha
- #211 real usability testing

## CTO reconciliation protocol (#369)

Run after approximately 3–5 merged UI/UX implementation lanes, before a UX phase exit, after changes to command/selection/operation/persistence contracts, or immediately after a cross-lane regression.

The reconciler must inspect at least:

- duplicate semantic or UI authority;
- active ownership/file conflicts;
- selection/focus parity across Plan/3D/tree/inspector;
- undo/redo grouping and canonical operation routing;
- hosted/dependent element integrity after wall edits;
- Plan/3D/sheet invalidation convergence;
- working-copy/save/Publish/export wording and actual durability state;
- responsive desktop/tablet/phone regressions;
- keyboard/focus/accessibility regressions;
- visual token/z-index drift;
- performance/bundle regressions;
- Agent/import security/privacy/fidelity boundary drift;
- exact-head capability and phase-gate evidence.

After every pass, #369 comments on #377 (and the active phase epic) with exact integration SHA, lanes included, regressions repaired, remaining blockers, verified workflow coverage, next safe parallel lanes and human/device evidence debt.

## Standard child-issue agent handoff

Use the following instruction for an implementation agent after selecting exactly one child issue:

```text
Work end to end on ARQ GitHub issue #<ISSUE_NUMBER> in repository ruddvz/Arq.

Before changing anything:
1. Fetch the actual current integration authority. Do not assume main or any SHA written in the issue is still current.
2. Read the complete issue, its UI/UX phase epic, #377, AGENTS.md and .zeus/FAST-KERNEL.md. Read deeper ZEUS modules only when routing requires them.
3. Read every explicit dependency and semantic/domain owner linked by the issue.
4. Check active PRs/issues touching the same files/interfaces. Follow #317/#319 ownership rules when available. If ownership conflicts, stop and comment before editing.
5. Search for the existing system/component/operation before creating another.

During implementation:
- Stay within the issue's in-scope contract.
- Use canonical ARQ commands/typed operations/validation/persistence. Renderer or local UI state must not become semantic project truth.
- Handle the issue's loading, empty, disabled, error, read-only, responsive, accessibility and performance states, not only the happy path.
- Do not resolve open architecture/unit/security decisions incidentally.
- Post issue progress updates at meaningful checkpoints with branch/head SHA, claimed files/interfaces, changed assumptions, evidence run, blockers and follow-ups.

Before claiming completion:
- Rebase/reconcile against the actual integration head as required by repository policy.
- Run the exact focused/package/browser/visual/performance/accessibility evidence required by the issue and ZEUS tier.
- Do not call an open PR, stale test run or screenshot alone completion.
- Record remaining limitations honestly and leave broad cross-lane fixes for #369 unless they are a bounded consequence of this issue.
```

## Definition of programme completion

#377 is not complete because all child issues are closed. It is complete only when the applicable UX phases have passed their exit gates, #476 proves the protected Core workflow, #492 reconciles final quality/human/device evidence, and #369 finds no unresolved cross-lane authority/integration defect for the claimed release envelope.

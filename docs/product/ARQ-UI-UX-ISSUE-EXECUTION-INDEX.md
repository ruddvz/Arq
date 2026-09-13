# ARQ UI/UX issue execution index

**Status:** live routing index for the UI/UX programme  
**Programme:** #377  
**Universal programme:** #367  
**UX-0 authority:** #379  
**Issue-contract authority:** #368  
**Recurring CTO reconciler:** #369  
**Ownership protocol:** #317 / #319  
**Graph reconciliation:** #493

This file is a routing aid, not a product/evidence authority. Live repository state, accepted ADRs, exact-head executable evidence and the current issue/PR graph outrank this file. Agents must re-preflight before mutation.

## Current repository-authority warning

As of the preflight that created this index, GitHub still reports `claude/arq-cad-platform-research-ba8rav` as the repository default branch, while `main` exists and all currently open PRs are based on `main`. Issue #332 remains the branch-authority governance issue. Do not infer integration authority from the repository default alone and do not assume `main` without a fresh #332/current-PR check.

Open PR ownership at this checkpoint:

- #361 owns `apps/web/src/App.tsx` plus native project persistence/session files. Any UI lane touching `App.tsx` is conflict-prone until #361 is merged/retired/reconciled.
- #363 owns browser-matrix workflow/scripts/docs.
- #365 owns ZEUS graph/runtime/CI files.
- #366 owns Archaiflow/competitor research documentation.

Until #317/#319 enforcement lands, open PRs are legacy owners of the paths they actually change. #364 is a visibility board, not the ownership authority.

## Operating model

1. One implementation agent works from one bounded child issue.
2. The child issue is the work ledger. Post branch/head, claimed files/interfaces, changed assumptions, evidence, blockers and follow-ups at meaningful checkpoints.
3. Different issue numbers do not imply safe parallelism. Shared root files, command/selection state and canonical operation/persistence paths require explicit sequencing.
4. Semantic/domain programme issues own canonical model, operations, persistence and safety policy. UI/UX child issues integrate, expose, refine and prove those capabilities unless their contract explicitly owns a domain change.
5. #369 is the recurring original/CTO lane. Run it after roughly 3–5 merged UI/UX lanes, before every phase gate, after a cross-cutting contract change, or when cross-lane regression appears.
6. #493 reconciles the UI/UX graph against P1/P2/P3 semantic owners so two agents do not implement the same capability under different issue numbers.

## Phase epics

| Phase | Epic | Outcome |
| --- | --- | --- |
| UX-0 | #379 | Inventory, authority and interaction-contract freeze |
| UX-1 | #381 | Canvas-first shell and visual hierarchy |
| UX-2 | #383 | Commands, selection and contextual interaction unification |
| UX-3 | #384 | Release-1 plan authoring UX completion |
| UX-4 | #386 | Levels, project browser and coordinated 3D UX |
| UX-5 | #388 | File, persistence, import/export and recovery UX |
| UX-6 | #390 | Sheet/document workflow UX |
| UX-7 | #392 | Inspectable Agent/Review Centre UX |
| UX-8 | #394 | Accessibility, resilience, responsive and performance hardening |

## Initial safe discovery/routing frontier

These UX-0 lanes are the intended first batch because they are audit/metadata heavy and can avoid broad runtime mutation:

- #396 shell/panel/overlay/shared-file ownership audit
- #398 command/tool/capability reachability audit
- #401 selection/focus/interaction-state authority audit
- #403 design-token/local-constant/overlay-layer audit
- #405 Pascal adoption/licence/provenance ledger
- #493 UI/UX ↔ P1/P2/P3 issue-graph reconciliation

Important current conflict: #396/#493 must treat PR #361 as the live owner of `apps/web/src/App.tsx`. UX-1 root-shell implementation must not begin until that ownership is reconciled.

## UX-1 shell lanes

- #407 desktop canvas-first shell
- #409 panel collapse/resize/docking/reopen
- #412 overlay zones/floating controls/z-index
- #414 tablet touch/Pencil-first composition
- #416 phone review/light-edit composition
- #418 shell empty/loading/disabled/read-only/error states

Do not start broad root-shell work until #396, #403 and #493 establish current ownership/dependencies. `apps/web/src/App.tsx` and shared workspace state are serialised resources.

## UX-2 interaction-language lanes

- #420 canonical command metadata/dispatch
- #423 command palette/context menus/disabled reasons
- #425 unified selection/multi-selection/primary selection
- #427 canonical active-tool HUD/lifecycle
- #429 keyboard shortcuts/Escape/back/focus restoration

## UX-3 plan-authoring UI slices

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

Semantic/domain owners to reconcile first: #378 walls, #380 hosted openings, #382 rooms, #385 dimensions, #387 notes, #389 cross-surface invalidation, #391 browser/inspector, #88 units/numeric representation, #464 tolerance ladder, #465 semantic subreferences, #452 locale/formatting.

## UX-4 project navigation and 3D

- #451 compact storey/level selector
- #454 safe level create/rename/duplicate/delete
- #455 level visibility/isolation/context
- #456 project browser hierarchy/selection/performance
- #457 3D camera/fit/reset/selection coordination
- #458 safe direct 3D edits + Plan hand-off

Coordinate cross-surface work with #389 and browser/inspector work with #391. Renderer objects never become canonical project state.

## UX-5 file, durability and exchange UX

- #459 durability/project-file state model
- #460 persistence acknowledgements → durability UI
- #461 open/hydrate/migrate/load-failure states
- #462 recovery review/restore/discard
- #463 read-only/safe-mode behaviour
- #466 universal import fidelity/staging UI
- #469 canonical native Publish/download-copy UX
- #471 external export fidelity/delivery UX

Domain owners: #371 publication authority, #355 persistence bridge, #356 lossless semantic mutation, #410 exchange epic, #411 DXF, #413 IFC, #415 universal fidelity contract, #446 untrusted file boundary.

## UX-6 sheet/document UX

- #472 sheet navigation/workspace context
- #473 viewport selection/placement/arrangement
- #474 paper + viewport scale controls
- #475 PDF preflight/progress/result UX
- #476 protected UI/UX workflow proof

Domain/release owners: #393 sheet/viewports, #395 scaled vector PDF, #406 Core E2E release harness.

## UX-7 Agent / Review Centre UX

- #477 Agent surface in workspace
- #478 proposal diff/assumptions/validation presentation
- #479 affected-object preview/highlight
- #480 governed Approve/Reject/result/Undo UX
- #481 failure/interruption/outcome truth
- #482 connection/grant/expiry/context status
- #483 provenance/evidence history projection

Agent domain owners: #419, #421, #422, #424, #428 and privacy/diagnostics #448. UI lanes may not create a second mutation, permission, persistence or provenance authority.

## UX-8 final quality/evidence

- #484 final accessibility/keyboard reconciliation using #400
- #485 touch/Pencil parity using #359 physical evidence
- #486 reduced-motion/motion-token enforcement
- #487 visual-regression matrix
- #488 weak-GPU/renderer failure fallback
- #489 UI latency/bundle budgets using #402
- #490 repeated open/close/resource-leak stress
- #491 first-run/help/shortcut reconciliation using #404
- #492 final programme acceptance + CTO handoff

Existing gate owners include #358, #359, #360, #400, #402, #404, #408 and #211.

## CTO reconciliation protocol

Run #369 after approximately 3–5 merged UI/UX implementation lanes, before a phase exit, after command/selection/operation/persistence contract changes, or immediately after a cross-lane regression.

The reconciler inspects duplicate authority, ownership collisions, selection/focus parity, undo grouping, hosted dependency integrity, Plan/3D/sheet convergence, durability wording, responsive regressions, accessibility/focus, token/z-index drift, performance/bundle regressions, resource leaks, Agent/import boundaries and exact-head phase evidence.

After every pass, update #377 and the active phase epic with the exact integration SHA, included lanes, regressions repaired, remaining blockers, verified workflow coverage, next safe parallel lanes and human/device evidence debt.

## Standard implementation-agent handoff

```text
Work end to end on ARQ GitHub issue #<ISSUE_NUMBER> in repository ruddvz/Arq.

Before changing anything:
1. Determine the actual current integration authority from #332, repository metadata and current PR bases. Do not assume main or the repository default branch.
2. Read the complete issue, its phase epic, #377, AGENTS.md and .zeus/FAST-KERNEL.md.
3. Read every explicit dependency and semantic/domain owner linked by the issue.
4. Check active PRs/issues touching the same files/interfaces. Until #317/#319 enforcement lands, treat open PRs as legacy owners of their actual changed paths. If ownership conflicts, stop and comment before editing.
5. Search for the existing component/system/operation before creating another.

During implementation:
- Stay inside the issue contract.
- Use canonical ARQ commands, typed operations, validation and persistence.
- Handle loading, empty, disabled, error, read-only, responsive, accessibility and performance states, not only the happy path.
- Do not resolve open architecture/unit/security decisions incidentally.
- Update the issue at meaningful checkpoints with branch/head SHA, touched files/interfaces, changed assumptions, evidence, blockers and follow-ups.

Before claiming completion:
- Reconcile against the actual integration authority as required by repository policy.
- Run the issue/ZEUS-required focused, package, browser, visual, performance and accessibility evidence.
- An open PR, stale test run or screenshot alone is not completion.
- Record remaining limitations honestly and route broad cross-lane defects to #369.
```

## Programme completion

#377 does not complete from issue count. It completes only when applicable UX phases pass their exit gates, #476 proves the protected Core workflow, #492 reconciles final quality/human/device evidence, and #369 finds no unresolved cross-lane authority/integration defect for the claimed release envelope.

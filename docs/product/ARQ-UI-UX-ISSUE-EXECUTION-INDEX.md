# ARQ UI/UX issue execution index

**Status:** live routing index for the UI/UX programme  
**Programme:** #377  
**Universal programme:** #367  
**UX-0 authority:** #379  
**Issue-contract authority:** #368  
**Recurring CTO reconciler:** #369  
**Ownership protocol:** #317 / #319  
**Graph reconciliation:** #493  
**Semantic-owner matrix:** `docs/product/ARQ-UI-UX-SEMANTIC-OWNER-MATRIX.md`  
**Pascal adoption ledger:** `docs/research/PASCAL-EDITOR-ADOPTION-LEDGER-2026-09.md`

This file is a routing aid, not a product/evidence authority. Live repository state, accepted ADRs, exact-head executable evidence and the current issue/PR graph outrank this file. Agents must re-preflight before mutation.

## Current checkpoint

UX-0 static discovery/routing has now produced repository-visible artefacts for #396, #398, #401, #403, #405 and #493. #405 is complete and closed. #493 has reconciled the UI/UX issue family against P1/P2/P3 owners in `ARQ-UI-UX-SEMANTIC-OWNER-MATRIX.md`.

This does **not** make UX-0 or UX-1 green by itself. #396/#398/#401/#403 still require their issue-specific exact-head executable/browser evidence before those audit lanes should close. #369 must record the first CTO reconciliation before broad UX-1 mutation is promoted.

## Current repository-authority warning

GitHub still reports `claude/arq-cad-platform-research-ba8rav` as the repository default branch while active development PRs are based on `main`. Issue #332 remains the branch-authority governance issue. Do not infer integration authority from the repository default alone and do not assume `main` without a fresh #332/current-PR check.

Open PR ownership at this checkpoint includes:

- #361 owns `apps/web/src/App.tsx` plus native project persistence/session files. Any UI lane touching `App.tsx` is conflict-prone until #361 is merged, retired or explicitly reconciled.
- #363 owns browser-matrix workflow/scripts/docs.
- #365 owns ZEUS graph/runtime/CI files.
- #366 owns Archaiflow/competitor research documentation.

Until #317/#319 enforcement lands, open PRs are legacy owners of the paths they actually change. #364 is a visibility board, not the ownership authority.

## Operating model

1. One implementation agent works from one bounded child issue.
2. The child issue is the work ledger. Post branch/head, claimed files/interfaces, changed assumptions, evidence, blockers and follow-ups at meaningful checkpoints.
3. Different issue numbers do not imply safe parallelism. Shared root files, command/selection state and canonical operation/persistence paths require explicit sequencing.
4. Semantic/domain programme issues own canonical model, operations, persistence and safety policy. UI/UX child issues integrate, expose, refine and prove those capabilities unless their contract explicitly owns a domain change.
5. #369 is the recurring original/CTO lane. Run it after roughly 3-5 merged UI/UX lanes, before every phase gate, after a cross-cutting contract change, or when cross-lane regression appears.
6. #493 reconciles the UI/UX graph against P1/P2/P3 semantic owners. Its current result is the semantic-owner matrix linked above.
7. A UI lane that discovers a missing semantic/domain API must stop or narrow itself. It may not silently become the semantic authority simply because the API is missing.

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

## Reconciled domain-owner direction

Use `ARQ-UI-UX-SEMANTIC-OWNER-MATRIX.md` for the complete routing table. The high-value owner relationships are:

- #374 owns native project/level authoring. #451/#454/#455 integrate level navigation/workflows and may not invent level mutation policy.
- #378 owns wall semantics. #431/#433/#435 are interaction slices.
- #380 owns hosted openings/door/window semantics. #437/#439/#441 are UI interaction slices.
- #382 owns room semantics. #443 is the room workflow slice.
- #385 + #465 own dimension semantics/stable references. #445 owns dimension placement/edit interaction.
- #387 owns notes. #447 owns note interaction.
- #389 owns cross-surface canonical/derived coordination. UX-4 consumes it rather than creating a second invalidation authority.
- #391 owns browser/inspector Core product semantics. #449/#456 integrate numeric and hierarchy/selection UX.
- #468 owns Core plan projection; #470 owns coordinated 3D projection.
- #371/#355/#356/#397 own publication/persistence/durability mechanics. UX-5 presents/integrates them.
- #415 with #411/#413 owns exchange fidelity/adapters. #466/#471 consume those contracts.
- #393 owns sheet/viewports; #395 owns PDF; #406 owns protected Core E2E. #472-#476 are their UI/integration/evidence slices.
- #419/#421/#422/#424/#428 own Agent host/proposal/apply/eval semantics. #477-#483 own Agent/Review Centre UX only.
- #400/#402/#404/#358-#360/#408/#211 remain the quality/human/platform authorities consumed by UX-8.

#454 was specifically reconciled to existing owner #374. Do not create a second level-operation architecture under the UI issue.

## Current safe parallel frontier

The next safe batch is evidence closure, not broad shell implementation:

- **#396** finish exact-head focused/browser evidence for the workspace ownership map. No redesign and no `App.tsx` mutation while #361 owns it.
- **#398** finish deterministic command/tool reachability and registry evidence. No new commands or command behaviour.
- **#401** finish state-flow/browser evidence for Plan/3D/tree/inspector selection/focus. No selection redesign.
- **#403** finish deterministic token/layer evidence and bounded lint/check strategy. No broad restyling.

#405 is complete. #493 static reconciliation is complete enough for the first #369 pass.

### Explicitly not safe yet

- #407 root desktop shell: blocked by shared `App.tsx` ownership and UX-0 evidence/reconciliation.
- #414/#416 responsive root composition: depend on #409/#412 and also touch root composition.
- #418 full shell-state integration: conflict-prone while #361 owns `App.tsx`; a future agent may work only on narrowly claimed reusable design-system primitives if there is no overlap.
- #420 canonical command integration: wait for #398 evidence and root-dispatch ownership reconciliation.
- #425 selection implementation: wait for #401 evidence.

### Intended first UX-1 frontier after the gate clears

When #396/#403 close with evidence, #361 root ownership is resolved, and #369 records a safe frontier:

1. #409 panel collapse/resize/docking/reopen may proceed on claimed design-system/workspace paths.
2. #412 overlay zones/floating controls/z-index may proceed in parallel only where paths/interfaces do not overlap #409 or active Plan/3D owners.
3. #407 remains the serial root-shell composition lane that integrates those contracts.
4. #414/#416 follow #409/#412 and consume the resulting responsive shell contract.
5. #418 can be split into reusable primitives first, root wiring later, if that avoids ownership collision.

## UX-1 shell lanes

- #407 desktop canvas-first shell
- #409 panel collapse/resize/docking/reopen
- #412 overlay zones/floating controls/z-index
- #414 tablet touch/Pencil-first composition
- #416 phone review/light-edit composition
- #418 shell empty/loading/disabled/read-only/error states

`apps/web/src/App.tsx` and shared workspace state are serialised resources.

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

These issues consume the domain owners in the semantic-owner matrix. They may not redefine units (#88), tolerance (#464), stable references (#465), locale/formatting (#452), plan projection (#468) or semantic mutation authority.

## UX-4 project navigation and 3D

- #451 compact storey/level selector
- #454 safe level create/rename/duplicate/delete
- #455 level visibility/isolation/context
- #456 project browser hierarchy/selection/performance
- #457 3D camera/fit/reset/selection coordination
- #458 safe direct 3D edits + Plan hand-off

Domain direction: #374 levels, #389 cross-surface coordination, #391 browser/inspector, #470 coordinated 3D, plus the semantic owner of every mutation exposed by #458. Renderer objects never become canonical project state.

## UX-5 file, durability and exchange UX

- #459 durability/project-file state model
- #460 persistence acknowledgements -> durability UI
- #461 open/hydrate/migrate/load-failure states
- #462 recovery review/restore/discard
- #463 read-only/safe-mode behaviour
- #466 universal import fidelity/staging UI
- #469 canonical native Publish/download-copy UX
- #471 external export fidelity/delivery UX

Domain owners: #371 publication authority, #355 persistence bridge, #356 lossless semantic mutation, #397 durability matrix, #410 exchange epic, #411 DXF, #413 IFC, #415 universal fidelity contract, #446 untrusted file boundary.

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

Run #369 after approximately 3-5 merged UI/UX implementation lanes, before a phase exit, after command/selection/operation/persistence contract changes, or immediately after a cross-lane regression.

The reconciler inspects duplicate authority, ownership collisions, selection/focus parity, undo grouping, hosted dependency integrity, Plan/3D/sheet convergence, durability wording, responsive regressions, accessibility/focus, token/z-index drift, performance/bundle regressions, resource leaks, Agent/import boundaries and exact-head phase evidence.

After every pass, update #377 and the active phase epic with the exact integration SHA, included lanes, regressions repaired, remaining blockers, verified workflow coverage, next safe parallel lanes and human/device evidence debt.

## Standard implementation-agent handoff

```text
Work end to end on ARQ GitHub issue #<ISSUE_NUMBER> in repository ruddvz/Arq.

Before changing anything:
1. Determine the actual current integration authority from #332, repository metadata and current PR bases. Do not assume main or the repository default branch.
2. Read the complete issue, its phase epic, #377, #493, docs/product/ARQ-UI-UX-ISSUE-EXECUTION-INDEX.md, docs/product/ARQ-UI-UX-SEMANTIC-OWNER-MATRIX.md, AGENTS.md and .zeus/FAST-KERNEL.md.
3. Read every explicit dependency and semantic/domain owner linked by the issue.
4. Check active PRs/issues touching the same files/interfaces. Until #317/#319 enforcement lands, treat open PRs as legacy owners of their actual changed paths. If ownership conflicts, stop and comment before editing.
5. Search for the existing component/system/operation before creating another.
6. Post a claim checkpoint before mutation: branch/head, claimed paths/interfaces, semantic/domain authority consumed, explicit exclusions and known conflicts.

During implementation:
- Stay inside the issue contract.
- UI work integrates domain authority; it does not create a parallel canonical model, operation, persistence, permission or provenance path.
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

# ARQ UI/UX semantic-owner matrix

**Issue:** #493  
**Parent programme:** #377  
**Universal programme:** #367  
**Snapshot date:** 2026-09-13  
**Snapshot integration line:** current `main` after #405, beginning at `96a9bdbf518d11db54d7efb632daa364a0364e20`  
**Recurring reconciler:** #369

This is a routing map, not a product-truth authority. Current code, accepted ADRs, exact-head evidence, live PR ownership and the domain issues named below outrank it. Re-run #493/#369 when the universal programme adds or materially changes an overlapping domain owner.

## Routing rule

A UI/UX issue may own presentation, input mechanics, discoverability, previews, disabled/error states, accessibility, responsive composition and exact-head interaction evidence. It does not own canonical semantic identity, mutation, persistence, fidelity, permission, provenance or renderer truth unless its issue contract explicitly says so and no stronger domain owner exists.

## Reconciled overlap matrix

| UI/UX slice | Semantic/domain owner | UI/UX authority | Routing constraint |
| --- | --- | --- | --- |
| #431 wall drafting feedback | #378 wall semantics; #468 plan projection; #464 tolerance policy | cursor/snap/preview/feedback and interaction evidence | Reuse current wall operation/snap paths. Do not change wall semantics or tolerance policy locally. |
| #433 exact wall length/angle | #378 wall semantics; #88 numeric representation; #452 locale/formatting; #464 tolerance | HUD/input/focus/validation presentation | Do not settle #88 or introduce a local parser/unit authority. |
| #435 wall reshape handles | #378 wall semantics; #356 rich semantic mutation; #389 invalidation | direct-manipulation preview/handles/commit UX | Semantic dependency/host policy comes from owners. One gesture may only dispatch the canonical operation. |
| #437 door placement | #380 hosted openings; #468 plan projection | host-hover/preview/tool flow/selection hand-off | No UI-owned hosted-opening mutation or collision policy. |
| #439 door hand/side/swing | #380 hosted opening/door semantics | direct/inspector controls over supported semantic fields | Renderer transforms cannot be the mutation source. |
| #441 window placement/editing | #380 hosted openings; #468/#470 projections | host preview, size/sill input, selection/inspector UX | Reuse the same hosted-opening authority as door work. |
| #443 rooms | #382 room semantics; #389 invalidation; #464 tolerance | bounded/unbounded feedback, command and inspection UX | Boundary/area/recompute truth stays in domain algorithms. |
| #445 dimensions | #385 dimensions; #465 semantic subreferences; #88/#452 numeric/display rules | reference-pick/offset/edit/broken-reference UX | Do not create coordinate/nearest-geometry reference authority in the UI. |
| #447 text notes | #387 note semantics/persistence | placement/edit/focus/selection UX | Note content/placement commits through canonical note operations. |
| #449 inspector numeric editing | #391 browser/inspector product owner; #88 canonical numeric decision; #452 locale/formatting | reusable numeric draft/commit/mixed-value interaction | UI may not create local domain parsers or direct model mutation. |
| #451 compact level selector | #374 project/level semantic state; #389 cross-surface coordination | compact active-level navigation | Switching level is workspace/view state. Do not mutate level semantics. |
| #454 level CRUD | #374 project/level authoring; persistence via #355/#356 as applicable | safe CRUD workflow and consequence presentation | #454 must consume proven typed level operations. It must not invent duplicate/delete cascade semantics. |
| #455 level visibility/isolation | #389 cross-surface coordination; #468/#470 view projections | view/session visibility controls | Visibility is presentation/view state, never semantic deletion. |
| #456 project browser | #391 browser/inspector; #425 selection | hierarchy/search/reveal/large-tree UX | Browser remains a projection of canonical data, not a semantic cache authority. |
| #457 3D camera/selection | #470 coordinated 3D; #389 invalidation; #425 selection | camera controls/fit/reset/discoverability | Camera is view state. Picks resolve to canonical semantic IDs via #470. |
| #458 direct 3D edits | #470 3D domain plus each applicable semantic owner (#378/#380/etc.); #389 invalidation | expose only proven direct edits and Plan hand-off | No renderer-owned mutations. Every 3D edit must dispatch the same typed operation as other surfaces. |
| #459 durability state model | #355/#356 working-copy persistence; #371 publication; #397 durability matrix | one truthful UI-facing durability state machine | No new save queue or inferred `saved` state. Root App work remains serialised. |
| #460 persistence acknowledgements | #355/#356; active persistence PR successors | bind real acknowledgements to #459 UI | No second persistence queue or demo fallback masquerading as native durability. |
| #461 open/hydrate/migrate UX | file/ARQFS and migration owners; #397 durability/failure evidence | stage/progress/refusal/recovery presentation | UI consumes real events and cannot bypass safe preflight/migration policy. |
| #462 recovery review | journal/native recovery owners; #397 | provenance/review/restore/discard UX | Restoration enters through existing recovery authority, not UI reconstruction. |
| #463 read-only/safe mode | #420 command availability plus native capability/security owners | consistent gating/reason presentation | UI gating is not write/security enforcement. |
| #466 import staging | #415 shared fidelity contract; #411 DXF; #413 IFC; #446 untrusted-file boundary | one shared staging/review surface | Adapters own parse/fidelity facts. UI cannot weaken common fidelity vocabulary. |
| #469 native Publish UX | #371 publication; #355/#356 working copy; #459/#460 durability projection | canonical user-facing Publish lifecycle | Exactly one native publication path. Success only after canonical verification. |
| #471 external export UX | #415 plus applicable exporter such as #411 | fidelity/preflight/generation/delivery presentation | Export remains read-only over project state and actual adapter job results. |
| #472 sheet navigation | #393 sheet/document semantics; shell #407/#420 | integrate the real sheet surface into workspace navigation | Never invent sheet IDs/document state in shell code. |
| #473 viewport arrangement | #393 document operations; #425 selection patterns | direct manipulation over sheet viewport objects | Viewport references model/view, never copied building geometry. |
| #474 paper/scale controls | #393 document scale; #449 numeric UX; #88 units | paper/scale input and warnings | UI and PDF must consume same document scale. |
| #475 PDF lifecycle | #395 PDF generator/preflight | preflight/progress/result/delivery UX | UI does not reproduce export validation rules or claim success early. |
| #476 protected workflow UX proof | #406 canonical Core E2E harness; #369 integration | UI-specific acceptance assertions | No second E2E harness or feature implementation authority. |
| #477 Agent workspace surface | #419 P3 programme; #421 read-only Agent host | place Agent in existing shell/responsive composition | No second Agent host, permission or context authority. |
| #478 proposal presentation | #422 proposal schema | information architecture/diff/assumption/validation presentation | UI is a projection of exact typed proposal data. |
| #479 proposal affected-object preview | #422 proposal IDs; #389 cross-surface projection; #425 selection | disposable cross-surface preview/highlight | Preview cannot mutate project/renderer semantic authority. |
| #480 Approve/Reject/result/Undo | #424 governed apply; #459 durability | interaction around exact reviewed apply and result | Approve cannot regenerate or bypass #424. |
| #481 Agent failure truth | #421/#424 real outcomes; #428 eval taxonomy; #459 durability | user-facing failure/retry/outcome UX | Mutation/durability outcome comes only from canonical result contracts. |
| #482 Agent grant/context status | #421 grant/session authority | concise permission/context/expiry presentation | No UI permission escalation or secret/token exposure. |
| #483 Agent provenance view | #422/#424 provenance; #448 privacy | read-only projection/history UI | Never create a second mutable audit/project-history authority. |
| #484 accessibility reconciliation | #400 Core accessibility | final programme regression/evidence pass | #400 remains the accessibility authority. |
| #485 tablet/Pencil parity | #359 physical-device evidence plus feature owners | final input-parity reconciliation | Simulation cannot promote physical-device support. |
| #486 reduced motion | #403 token audit; #400 accessibility | central motion/reduced-motion enforcement | Presentation only. Motion cannot delay or own semantic commit. |
| #487 visual regression | integrated feature owners | deterministic visual fixtures/matrix | Pixel diffs do not prove semantic correctness. |
| #488 renderer failure UX | #470 renderer/domain; #358/#360 support envelope | failure/fallback/retry presentation | Renderer failure never mutates project state or expands support claims. |
| #489 UI performance reconciliation | #402 performance budgets | measure/fix programme-added hot paths | #402 owns budget definitions; do not game fixtures/windows. |
| #490 lifecycle stress | session/Worker/renderer/Agent lifecycle owners; #402 | integrated leak/resource evidence | Test/instrumentation only unless a bounded owner defect is found. |
| #491 help/shortcut reconciliation | #404 help; #420 commands; #427 tool lifecycle | final drift/usability reconciliation | Help should derive from current command/tool metadata where possible. |
| #492 final programme acceptance | #406/#400/#402/#358-#360/#408/#211 plus #369 | final evidence aggregation and handoff | No feature-count completion or evidence waivers. |

## True duplicates

No current UI/UX child issue was found to be a true duplicate that should simply replace a listed P1/P2/P3 issue. The primary failure mode is **authority ambiguity**, not identical scope: UI issues often describe correct domain ownership in prose while their compact dependency metadata omits that owner.

#454 had the clearest potential accidental-domain-owner risk. The correct existing semantic owner is #374, which already owns native project/level creation and typed level update operations. #454 therefore owns the safe user workflow over #374 operations, not level semantics themselves.

## High-conflict serialised resources

Treat these as serial resources even when issue numbers differ:

- `apps/web/src/App.tsx`: currently owned by open PR #361; #407, #418, #420, #451, #459/#460, #469, #472, #477 and other root integrations must not mutate it concurrently.
- Plan interaction authority (`PlanCanvas`, tool pointer ownership, wall/opening/room flows): #425/#427 and UX-3 authoring lanes require explicit file/interface claims.
- Model/3D interaction authority: #425/#457/#458 and #470 must be sequenced when touching the same renderer/pick/view contracts.
- canonical operations/persistence: domain P1 owners and #355/#356 outrank UI convenience edits.
- command and selection state: #420 and #425 are cross-cutting authorities and should land before dependent UX-2/UX-3 surfaces fork local state.

## Current safe frontier after reconciliation

At this snapshot the safe next work is **UX-0 evidence closure**, not broad UX-1 root mutation:

1. #396: finish exact-head focused/browser ownership evidence without redesigning the shell.
2. #398: finish deterministic reachability/registry evidence and reconcile the product-capability ledger without adding commands.
3. #401: finish state-flow/browser evidence for Plan/3D/tree/inspector selection and focus without redesigning selection.
4. #403: finish deterministic token/layer evidence and bounded lint/check recommendations without broad restyling.
5. #405: complete and closed at commit `96a9bdbf518d11db54d7efb632daa364a0364e20`.
6. #493: this matrix plus the execution-index update complete the static routing pass; #369 must now reconcile before UX-1 mutation is promoted.

Do **not** start broad #407/#414/#416/#418 root composition work while PR #361 still owns `App.tsx`. Do **not** start #420 while #398 evidence remains open and the root dispatch host is conflicted. Do **not** start #425 implementation while #401 evidence remains open.

Once #396/#403 are accepted, #361 ownership is resolved, and #369 records a green routing checkpoint, the intended UX-1 ordering is:

- #409 panel behaviour and #412 overlay contract can proceed in parallel only with non-overlapping claimed paths/interfaces;
- #407 is the serial root-shell composition owner and integrates those contracts;
- #414/#416 follow #409/#412 and consume the resulting shell contract;
- #418 may begin earlier only if narrowed to reusable design-system state primitives that do not touch `App.tsx`; root wiring stays serialised.

## Reconciliation triggers

Re-run this map or #369 immediately when:

- a new universal-programme issue claims an existing UI semantic surface;
- #88/#464/#465 changes numeric/tolerance/reference contracts;
- #355/#356/#371 changes persistence/publication authority;
- #374/#378/#380/#382/#385/#387/#389/#391/#393/#470 changes an API consumed by UI slices;
- #421/#422/#424 changes Agent context/proposal/apply authority;
- an open PR changes high-conflict files outside its declared lane;
- a UI issue starts implementing semantic mutation because its expected domain API is missing.

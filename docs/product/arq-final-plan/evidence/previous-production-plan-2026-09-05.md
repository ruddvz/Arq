# ARQ: production readiness and product excellence plan

Prepared 5 September 2026. Planning only; no implementation, PR creation, merge or deployment is authorized by this document.

## Decision

**Prioritize trustworthy authoring and portable project delivery before expanding AI or cloud scope.** ARQ has substantial domain libraries, a distinctive visual identity and meaningful safety tests. Its most consequential weakness is integration: a component or tested library can exist without delivering the user workflow its name implies.

The recommended first production product is the existing Release 1: create a small architectural project, draw and edit building elements, document one plan, recover work and deliver a verified `.arq` file and vector PDF. Then deliver interoperability and review, followed by controlled AI and advanced iPad capabilities. This preserves the repository's release ladder while allowing an ambitious long-term product.

“Perfect” is not a verifiable finish condition. This plan substitutes explicit user outcomes, failure proofs, quality budgets and release gates. Completing documents or accumulating passing unit tests is insufficient to ship.

## Baseline and confidence

- Primary checkout: `/Users/rudra/Projects/Arq`.
- Local HEAD: `2c07adbe3594e35c111f33f123e9399d5c492ae0`; `git ls-remote origin HEAD` returned the same commit during this review.
- Working tree: **88 status entries**, including **49 tracked changed files**, at inspection time. The tracked diff reported 4,714 insertions and 1,015 deletions. Untracked additions are additional scope. These counts are a snapshot, not a stable branch identity.
- Older checkout: `/Users/rudra/Documents/Codex/2026-08-31/https-github-com-ruddvz-arq-https`, HEAD `ea2fe5836c1ee470202cc93f48371d9ece90e71e`, contains uncommitted persistence work. Treat it as a candidate source to compare and port selectively, never overwrite the newer project with it.
- The new AI improvement plan labels itself “Approved”; that label alone does not establish owner approval or supersede accepted ADRs and release scope.
- **Verified:** fresh typechecking succeeded for 37 workspace packages, with zero Turbo cache hits; contracts typechecking also exited successfully. **Verified:** 483 focused tests passed across 49 project, canvas and ARQFS files. Logs accompany this plan.
- **Partially verified:** source inspection of critical integration paths and browser inspection of the local editor at 1280×720 and 430×932; the running local marketing build was also inspected. Its source/build freshness was not established.
- **Not inspected:** every implementation file, full test suite, fresh production build, Rust/WASM execution, complete open/edit/export/reopen browser journey, deployed release, GitHub protection settings, real Safari/iPad/Pencil hardware, screen reader operation, load/security testing, and user research. Current production readiness is **not established**.

This is a broad, evidence-led planning review with targeted execution, not an exhaustive certification. The first slices close the remaining assessment gaps so later agents need not pretend they were already checked.

## Evidence-backed critique

Paths below are relative to the primary checkout. “Verified” means the stated observation was directly made; it does not certify the entire subsystem.

| ID | State and finding | Evidence | Consequence / work |
|---|---|---|---|
| E01 | Verified: two divergent local trees and extensive in-progress changes exist. | `git status --short`, `git log -1`, `git diff --stat`, remote HEAD query. | Reconcile before new agents touch overlapping files; S01. |
| E02 | Verified in source: canvas operations and undo/redo update `drawnWalls`, history and the local journal; the inspected handlers do not call `NativeProjectSession.save`. | `apps/web/src/App.tsx`, `performOperation`, `handleUndo`, `handleRedo`, around lines 728–765. | A portable copy cannot be assumed to contain displayed edits; S03–S06. Full browser reproduction remains pending. |
| E03 | Verified in source: native commit encoding rebuilds a project from name and walls. | `apps/web/src/project/native-project-session.ts`, `#commit`, and `native-project-model.ts`. | Wiring save blindly risks losing richer reference-model information. Preserve levels, types, openings, rooms, views and unknown supported data, or refuse editing; S03. |
| E04 | Verified in source: UI exposes `publishNativeProject(...)` and a separate `session.publish()` path used for Save a copy. | `apps/web/src/App.tsx`, around lines 785–887; native session; `packages/arqfs/src/arqfs-publication.ts`. | Consolidate one queue, verification contract, revision and delivery semantics; S06. |
| E05 | Verified in browser and source: Share records a demo action, activates Undo and shows “1 action(s) recorded.” Account menu also routes to `recordDemoAction` in source. | Browser steps 2–3; `App.tsx` around lines 1864, 1916–1918. | False affordances and pollution of model history; S02. |
| E06 | Verified in browser: empty workspace offers no visible New/Open sample guidance; title says Untitled project and Saved locally while portable Save a copy is disabled until a file is opened. | Steps 2 and 4. | Storage meaning and the first useful action are unclear; S07–S08. “Saved locally” is not by itself proof of data loss. |
| E07 | Verified visually: command palette uses serif text while editor chrome uses sans-serif; selected Views panel exposes a Model/Search model tree. | Steps 2 and 4. | Token/portal style coverage and information architecture need reconciliation; S09–S10. |
| E08 | Verified visually: phone layout preserves canvas space and disables unavailable Review, but tiny status text and a demo-action message compete with the bottom dock. | Step 5. | Preserve the responsive structure; improve status placement, text legibility and action feedback; S11. Contrast and target-size conformance were not measured. |
| E09 | Verified in browser: Sheets view is disabled with an explanation; source describes PDF limitations including a single line weight, no title block and only the current level. | `apps/web/src/sheets/sheet-export.ts`; steps 2 and 4. | A PDF function is not yet a complete document-production experience; S21–S23. |
| E10 | Verified: API entry point is `export {};`. Protocol, collaboration and telemetry packages contain code, but their presence is not proof of a deployed service. | `apps/api/src/index.ts`; package inventories. | Launch local-first honestly; build and verify cloud capabilities separately; S34–S38. |
| E11 | Verified: status text is explicitly dated and contains conflicting old/new claims; some package READMEs still say placeholder despite source implementations. | `STATUS.md`, package README/source comparison. | Use one capability record linked to runtime evidence; S01, S27. |
| E12 | Verified in source: CI names the legacy branch; engineering-gate workflow describes shadow operation. Live enforcement not inspected. | `.github/workflows/ci.yml`, `engineering-gate.yml`, ADR-0029. | Verify actual required checks, branch settings and deployment authority; S30. |
| E13 | Verified in source: uncommitted residential checks hard-code thresholds and infer habitable rooms from English name patterns. | `packages/validation/src/residential-code-linting.ts`. | Treat as experimental assistance; require jurisdiction, edition, applicability and provenance before compliance-facing use; S41. This review does not validate those code thresholds. |
| E14 | Partially verified: marketing combines candid pre-release caveats with illustrated “committed”/zero-clash/health claims and implementation-heavy language. | Local homepage accessibility tree, step 1. | Label illustrative UI, reconcile claims and simplify explanations; S27–S28. |

## Target experience

A new architect opens ARQ, creates a project with named units and a level, draws a room using precise walls, inserts a door and window, inspects their properties and sees matching plan/3D views. They dimension it, place it on a sheet, exports a correctly scaled PDF and downloads a portable project. Reloading, switching projects, going offline or interrupting a write never silently discards or misattributes committed work. Reopening the downloaded project reproduces the committed design.

Experts can perform that loop without leaving the keyboard unnecessarily. New users can discover it without knowing internal package names. Tablet users have a deliberate pen/touch interaction model. Phone users receive a clearly scoped workflow instead of compressed desktop chrome.

## Ordered implementation slices

Each S-ID is a proposed delivery slice, **not an existing ARQ issue or proof of completion**. Map it to `backlog/issues`, the implementation registers and accepted ADRs before creating work. Reuse completed implementation and add missing integration/evidence. An agent may split a slice into smaller PRs with the same acceptance contract; do not force one giant PR per row.

P0 = data integrity, misleading behavior or release authority blocker. P1 = complete Release 1 and launch quality. P2 = later release enhancement. XS/S/M/L are relative scope, not time estimates. Every size is provisional until S01.

| Slice | Priority / owner / size | Work and completion proof | Depends on |
|---|---|---|---|
| S01 Baseline and capability map | P0 · integration · M | Preserve both dirty trees, inventory intended changes, compare older persistence work, establish the integration revision. Map each Release 1 feature to UI entry, implementation, test, state and owner. Reconcile stale status/README claims. No blind branch replacement. | — |
| S02 Honest commands | P0 · editor UX · S | Remove demo-note fallbacks from production actions. Unimplemented Share/Account/commands are hidden or disabled with useful reasons. Clicking unavailable UI creates no journal entry or undo item. Audit every invocation surface against one command registry. | S01 |
| S03 Lossless project model | P0 · data/core · L | Define one canonical project schema and supported versions. Preserve reference-model levels/types/rooms/openings/views and unknown data according to explicit compatibility rules. Unsupported editing is read-only. A rich fixture survives encode/decode/edit with only intended semantic differences. | S01 |
| S04 Atomic durable edits | P0 · persistence · L | Route typed authoring operations through one serialized transaction/revision path. Commit model, inverse/history and durable metadata coherently. Inject failures between write stages: no partial state or false success; subsequent valid edits still succeed. Review ARQFS batch atomicity before connecting UI. | S03 |
| S05 Durable history and switching | P0 · persistence/editor · M | Undo/redo use S04; history is project-scoped, grouped deliberately, and unchanged on failed commit. Prove rapid edits, late Worker replies, close-during-save and A→B→A switching cannot lose or cross-write work. | S04 |
| S06 One portable-file pipeline | P0 · persistence · M | Reconcile Publish and Save a copy behind one queued snapshot/export/fresh-reopen service. Check project identity, revision and semantic equality; preserve original bytes. Distinguish verification, file delivery and cancel/failure. Saved/exported status never advances on a failed download. | S04–S05 |
| S07 New/open/recent lifecycle | P1 · editor/data · M | Make New project a real native working project; support naming, units, level setup, sample, recent projects and close. Renames persist. Invalid/unsupported files show actionable refusal; concurrent opens cannot adopt the wrong project. | S03–S06 |
| S08 Storage and recovery UX | P0 · persistence/UX · L | Distinguish unsaved changes, committed local working copy, portable copy and future cloud state. Provide recovery discovery, quota/storage persistence handling, backup reminder and export escape path. Test crash, eviction/cleared storage, denied persistence, full disk and interrupted migration. Never describe browser storage as an independent backup. | S04–S07 |
| S09 Navigation and shell | P1 · product/UX · M | Separate Views, Model and Sheets content; unify selected object, active level, view state and breadcrumbs. Verify fit/zoom/selection across tabs. Empty, loading, read-only and degraded states have one obvious next action. | S02, S07 |
| S10 Visual system consistency | P1 · design system · M | Apply existing tokens to canvas chrome, palette portals, search, dialogs, menus and tooltips. Fix typography divergence, focus/selected/disabled hierarchy and density. Capture light/dark, DPR and 200% zoom comparisons without masking regressions by resetting baselines. | S09 |
| S11 Responsive and input ergonomics | P1 · input/UX · L | Validate desktop, compact/large tablet, portrait/landscape and phone scopes. Handle touch targets, pen versus pan, palm interference, pointer cancellation/capture, keyboard appearing, safe areas and overlays. No status or dialog hides essential controls. Real iPad testing is a release gate for iPad claims. | S09–S10 |
| S12 Accessible editing | P1 · accessibility · L | Keyboard-accessible commands and non-drag alternatives; meaningful element tree and inspector; focus restoration; restrained live announcements; contrast, non-color states, reduced motion and zoom. Screen reader users can select, inspect, edit a property, undo and export through semantic UI. | S09–S11 |
| S13 Numeric foundation | P0 · geometry/core · M | Resolve ADR-0004 and tolerance-policy decisions with domain evidence. Separate canonical units, display units, snapping and geometric tolerances. Prove metric/imperial conversion, decimal input, extreme coordinates, NaN/overflow refusal and round trips. Avoid incidental unit migrations. | S01, S03 |
| S14 Complete wall editing | P1 · geometry/editor · L | Exact entry, constraints, chained walls, snapping, joins, trim/extend/move/delete and clear preview→commit feedback. Validate zero-length, near-collinear, crossing and degenerate cases through S04. Plan, model and reopened project agree. | S04–S05, S13 |
| S15 Doors and windows | P1 · BIM/editor · M | Wire existing placement/editing tools to the canonical pipeline. Validate host, offset, width, height, sill, orientation and overlap; define host move/delete behavior. Test selection, undo and durable reopen in plan and 3D. | S14 |
| S16 Rooms and levels | P1 · BIM/editor · L | Create/edit levels, room boundaries/names and area derivation with stable IDs. Explain invalid boundaries and topology changes; preserve room identity where justified. Cross-level copy/edit cannot move elements implicitly. | S14–S15 |
| S17 Selection and inspector | P1 · editor · M | Single/multiple selection, marquee, hierarchy filters and property edits behave consistently. Distinguish mixed values, instance/type properties and read-only values. Batch edits validate atomically and undo once; keyboard equivalents exist. | S14–S16 |
| S18 Dimensions and notes | P1 · documentation · M | Wire accurate linear dimensions and editable notes, units/precision formatting, legible placement and linked updates after model edits. No silent stale dimensions; all annotations persist and print. | S13–S17 |
| S19 Underlays | P1 · import/editor · M | Image ingress first, then PDF underlay. Provide scale calibration, placement, lock/opacity, provenance, relink/remove, limits and cancellation. Reject malformed/oversized content safely; reopen preserves placement and assets. | S03–S04, S13 |
| S20 Plan/3D correctness | P1 · rendering · L | Derive both views from the same model; audit levels, joins, hosted openings, labels, picking and clipping. Golden fixtures verify semantic/render agreement. Handle context loss and resource disposal; offer a useful fallback where necessary. | S14–S19 |
| S21 Sheet workspace | P1 · documentation/UX · M | Implement the visible Sheets destination with one plan sheet, paper/orientation, scale, margins, viewport crop and title-block metadata. Preview accurately represents output and remembers settings. | S18–S20 |
| S22 Professional vector PDF | P1 · export · L | Verify dimensional scale with numeric checks and a physical print test, lineweight hierarchy, cut/projected styles, text/fonts, symbols, page bounds and title block. Overflow is visible before export. Open output in independent viewers. | S21 |
| S23 Release 1 journey tests | P0 · quality · M | Browser test: new→author→undo/redo→reload→export `.arq`→fresh reopen→PDF. Include rich reference fixtures and failure matrix below. Run a production bundle with real Worker/OPFS; fixture hashes must remain unchanged. | S06–S22 |
| S24 Performance and memory | P1 · rendering/performance · M | Measure representative small/medium/large fixtures, real devices and cold/warm paths against existing budgets. Include p95 input latency, Worker transfer/serialization, long tasks, peak memory and repeated-open leaks. Optimize measured bottlenecks; record hardware and workload. | S20, S23 |
| S25 Local trust boundaries | P0 · security · M | Review untrusted SQLite/archive, image/PDF/DXF/IFC, Worker messages and scripts for resource exhaustion, path/URL abuse, injection and malformed input. Enforce size/time limits, cancellation, project/revision validation, CSP and least privilege. No critical/high unresolved exploitable finding in shipped paths. | S03–S06, S19 |
| S26 Diagnostics and support | P1 · reliability · M | Wire privacy-conscious local diagnostics, incident IDs, redacted opt-in support bundles and user-facing recovery help. Demonstrate that support can identify/recover a failed local write without raw project upload by default. Any remote transport requires an explicit data policy. | S08, S25 |
| S27 Truthful product copy | P0 · language/product · S | Reconcile website, editor, changelog, docs and pricing with the capability map. Label demos/illustrations; remove unsupported health, sync, precision, save and AI claims. Use the existing Language System verification ladder. | S01–S02, S06, S23 |
| S28 Marketing and onboarding | P1 · growth/UX · M | Improve start/try/sample/docs paths; show an actual proven project journey. Explain benefits before OPFS or repository details. Verify links, metadata, canonical URLs, sitemap/robots, social cards, keyboard navigation and responsive pages; use truthful structured data only. | S07, S27 |
| S29 Reproducible delivery | P0 · build/release · M | Frozen dependencies, known toolchain, fresh build/typecheck/test, Rust/WASM and parity checks where used, licence/SBOM/secret checks and versioned artifacts. Validate worker/WASM asset paths, cache headers and update compatibility on preview. | S01, S23, S25 |
| S30 Enforced release gates | P0 · release/owner · M | Inspect actual branch/environment settings, execute accepted branch migration if still needed, and complete shadow-to-required rollout under Engineering OS. Required checks cover changed integration SHA. Protected preview tests gain authorized scoped access, not weakened protection. Prove rejected bad build and normal safe rollout. | S29 |
| S31 Operational release drill | P0 · reliability/owner · M | Choose deployment owner/environment, health/status policy, rollback triggers and incident routing. Rehearse code rollback plus file-version compatibility and recovery. Verify deployed SHA, asset routes, cache behavior, smoke journey and diagnostic redaction. | S26, S29–S30 |
| S32 Licence, privacy and commercial readiness | P0 · owner/product · M | Resolve the recorded licence/visibility conflict using current settings; confirm dependency notices, privacy/terms/support ownership and release claims with qualified review as needed. Define free/paid scope, cancellation/refund support and entitlement rules before charging. No auto-publication of draft policy text. | S01, S25, S27 |
| S33 Pilot and launch | P1 · product/quality · M | Run realistic projects with 5–8 target architects; measure task completion, recovery comprehension and export confidence. Fix critical friction, run a broader beta and obtain owner release decision against the gates. Sample size is formative research, not statistical certification. | S23–S32 |
| S34 Cloud foundation | P2 · backend/security · L | Build API, identity/session lifecycle, tenancy and object authorization, rate limits, idempotency and audit events. Local authoring stays usable offline. Cross-tenant negative tests and restore drill pass before external beta. | S25, S31–S33 |
| S35 Semantic sync | P2 · sync/data · L | Transport versioned operations/snapshots, never raw SQLite pages. Define retries, deduplication, ordering, conflicts, offline queues, revoked access and stale clients. Prove convergence within supported single-writer semantics; defer concurrent geometry editing unless separately approved. | S34, S04 |
| S36 Share and review | P2 · collaboration/UX · L | Real share links with scope/expiry/revocation, viewer roles, comments/issues anchored to element IDs and revision, comparison and inaccessible/deleted states. Revocation is server-enforced; inaccessible projects never leak via previews. | S34–S35 |
| S37 DXF and IFC viewing | P2 · interoperability · L | Wire existing adapters with progress, units/origin handling, import reports, unsupported-feature warnings and loss accounting. Validate corpus files against independent tools; importing never silently replaces canonical geometry. | S19, S25, S33 |
| S38 Billing and service economics | P2 · backend/product · M | If paid cloud is chosen: hosted checkout, signed/idempotent webhooks, entitlements, grace/refund/cancellation flows, budget caps and abuse controls. Billing failure never traps local files. Model storage, bandwidth, compute and support cost per active project. | S32, S34 |
| S39 Reviewable AI | P2 · AI/editor · L | Wire existing typed ArqScript proposal work into an inspectable review UI: intent, assumptions, scope, before/after, validation, revision binding and grouped undo. Reject stale/unauthorized changes; cancel and provider failure leave the model untouched. | S04–S05, S17, S25, S33 |
| S40 Generative design and quantities | P2 · AI/BIM · L | Validate uncommitted layout, furnishing, metrics and cost work separately. Use constraint-based evaluation, accessible routes and editable alternatives. Quantities have units/provenance; cost ranges show location/date/rate assumptions. Avoid compliance or cost certainty from heuristic outputs. | S16, S39 |
| S41 Jurisdiction-aware checks | P2 · domain/validation · L | Replace universal-looking thresholds with reviewed rule packs keyed to jurisdiction, edition, building/use category and applicability. Show evidence, exclusions, missing inputs and overrides. English room names alone cannot establish legal use classification. | S13, S16, S40 |
| S42 Advanced documentation/exchange | P2 · BIM/documentation · L | Schedules, controlled IFC export, sections/elevations and revision workflows follow independent correctness gates. Publish exact supported subsets and round-trip/loss reports. | S22, S36–S37 |
| S43 Native iPad capabilities | P2 · platform/input · L | Files integration and supported Pencil hover/double tap/squeeze/haptics, then RoomPlan/LiDAR prototypes. Real hardware, entitlement, lifecycle and offline recovery evidence precedes availability claims. Preserve browser fallback. | S11, S23, S33 |
| S44 Continuous product improvement | P2 · product/reliability · M | Maintain regression corpus, compatibility policy, monthly incident/performance reviews and usability feedback loop. Evaluate new scope by measured user need. Reassess deferred roofs/stairs/families/plugins only through a new product decision. | S33 |

## Dependency and staffing rules

Critical path: **S01 → S03 → S04 → S05/S06 → S07/S08 → S13–S22 → S23 → S29–S33**. S02 can begin immediately after the baseline. Geometry decisions and the security inventory can start early; their completion is required before affected functionality ships.

After interfaces stabilize, future agents can work independently on design-system consistency, geometry, documentation and release infrastructure. This review spawned no subagents. Do not run multiple agents on `App.tsx`, the canonical schema or ARQFS protocol simultaneously without one named integration owner. Freeze and publish the contract before parallel consumers implement against it.

The key shared contracts are: canonical document schema; operation result/revision/error contract; persistence status state machine; command capability registry; selected-element/view identity; import/export loss report; and diagnostic event schema.

Do not start every row at once. Maximum useful work in progress is the number of genuinely independent interfaces. Finish the portable editing loop before distributing ambitious feature work.

## Mandatory failure and compatibility matrix

| Area | Required cases and expected behavior |
|---|---|
| Persistence | Write fails before/during/after transaction, rapid edits, undo while saving, close/publish while saving, worker crash, stale response, quota exhaustion. Last committed revision remains identifiable; failures cannot become later silent successes. |
| Files | Truncated/foreign/corrupt/unsupported `.arq`, sidecar-dependent file, rich reference model, migration interruption, failed export and cancelled delivery. Source untouched; actionable refusal or verified recoverable copy. |
| Project identity | Two projects/tabs, duplicate filenames, reopen after crash, old worker replies. Identity and revision checks reject mismatches; locks are released appropriately. |
| Geometry | Very small/large coordinates, overlapping openings, invalid polygons, zero lengths, tolerance boundaries, level changes, host deletion. Invalid operation leaves committed state unchanged. |
| Interaction | Keyboard-only, pointer cancel, pen/touch switching, zoom, rotation, modal focus, Escape, IME/decimal entry, reduced motion. Preview and committed result agree; cancellation changes nothing. |
| Rendering/export | Plan/3D/PDF consistency, print scale, fonts, long labels, clipping, high DPR, device context loss. No silent scaling or omitted unsupported content. |
| Updates | Old app/new file, new app/old file, cached assets with new workers, code rollback after migration. Explicit compatibility decision; no forced destructive downgrade. |
| Future cloud/AI | Token expiry/revocation, retries/out-of-order events, link revocation, stale proposals, prompt injection, budget exhaustion. No unauthorized data exposure or partial apply; local project remains recoverable. |

## Release gates and measurement

**Gate A — safe alpha:** S01–S08 and numeric decisions needed for editing are proven. No silent loss, model flattening or misleading successful action remains in supported workflows. Full portable round trip passes on the target alpha browser. Unsupported features are clearly unavailable.

**Gate B — Release 1 candidate:** all committed Release 1 scope is reachable and passes S23, accessibility review, PDF correctness and representative performance checks. Every critical journey has happy, error and recovery evidence. No open P0; any deferred P1 has an owner-approved scope change and matching public wording.

**Gate C — production:** reproducible artifact, enforced checks, licence/commercial decisions, deployment/rollback drill, verified deployed SHA and pilot feedback are complete. All evidence belongs to the exact candidate tree; passing on an older branch is insufficient. Broader launch waits for a monitored beta, not just a successful deployment.

Use `benchmarks/PERFORMANCE-BUDGETS.json` as the existing starting point: local interactive 2 seconds, selection median 50 ms, wall commit median 100 ms, undo median 150 ms and PDF export 5 seconds on the defined representative model. These are **planning targets**, not achievements. Add p95 and memory ceilings from real-device measurements, preserve fixture/hardware details and separate software-rendered CI regression signals from device certification.

Proposed pilot outcomes: at least 90% complete the core task without intervention after brief onboarding; every participant can explain where their work is stored and make an independent portable copy; no reproducible committed-data loss; critical export discrepancies resolved. These are product acceptance proposals requiring calibration, not existing measurements. Track time to first valid wall, first successful portable reopen, export success, recovery success and recurring support causes. Avoid collecting project content as analytics.

Target [WCAG 2.2 AA](https://www.w3.org/WAI/WCAG22/quickref/) for the applicable interface, including focus, keyboard operation, alternatives to dragging and status announcements. Screenshots cannot certify it. Browser storage can be quota-limited or evicted; use the [MDN storage documentation](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) to design persistence/recovery cases. Map the application security review to applicable [OWASP ASVS controls](https://owasp.org/www-project-application-security-verification-standard/), with scope-specific evidence rather than a blanket compliance claim.

## Agent handoff and token economy

Read this plan once, then load only the assigned slice and relevant evidence IDs. Follow `AGENTS.md` and the Zeus fast kernel; retrieve relevant modules rather than loading every planning pack. Prefer exact symbols and focused file ranges. Run focused checks during development, required package/repository gates at the prescribed PR boundary, and release checks only for an actual release candidate.

Each future implementation assignment should contain:

```text
Implement slice Sxx from ARQ-PRODUCTION-PLAN.md against the agreed integration revision.
First map it to existing ARQ issues and verify whether it is already implemented.
Read AGENTS.md and route only relevant Zeus modules. Preserve unrelated changes.
Own these paths: [explicit paths]. Depend on these agreed contracts: [contracts].
Deliver the slice's user outcome and listed failure proofs; reuse existing systems.
Stop at [implementation / draft PR / approved merge], as explicitly authorized.
Return changed behavior, exact evidence and revision, unresolved gaps, and rollback.
Do not claim success from a symbol existing, a cached test, or an updated screenshot baseline.
```

This is a reusable template; it has not been dispatched. Replace brackets with concrete scope before assigning work.

For every PR record: slice/backlog IDs, problem, final behavior, owned paths, data/schema impact, dependencies, test commands and outputs, screenshots where relevant, rollback, and remaining uncertainty. Reject “done” when UI wiring, failure cases, evidence or documentation claims are missing. Avoid unrelated refactors in safety fixes; extract responsibilities from `App.tsx` incrementally after behavior is proven.

## Decisions to resolve at the relevant gate

1. Confirm the stable integration branch and disposition of all existing uncommitted work (S01).
2. Confirm Release 1 support scope: desktop browsers, iPad authoring claims and phone capabilities (S11/S33).
3. Accept canonical units and calibrated tolerances through the repository's ADR process (S13).
4. Choose licence/visibility, privacy/support ownership and paid/free offering (S32).
5. Choose deployment ownership and complete live protection/access configuration (S30–S31).
6. Choose cloud/AI providers, regions, retention and spending limits only when those slices begin (S34/S38/S39).
7. Choose supported regulatory jurisdictions and expert review ownership before enabling compliance-facing rules (S41).

None of these decisions needs to interrupt this planning deliverable. They must not be silently invented by implementation agents when the affected work reaches its gate.

## Evidence commands

Run from the primary checkout unless specified. Results were observed in this review; no full-production assertion follows from them.

| Command/action | Result |
|---|---|
| `git log -1 --format='%H %cs %s'` and `git ls-remote origin HEAD` | Both identify `2c07adbe3594e35c111f33f123e9399d5c492ae0`. |
| `git status --porcelain` / `git diff --stat` | Dirty-tree baseline recorded above; working changes are not covered by the HEAD alone. |
| `pnpm exec turbo run typecheck --force` then `pnpm exec tsc -p contracts` | Exit 0; 37 successful, 0 cached. |
| `pnpm exec vitest run apps/web/src/project packages/arqfs/src apps/web/src/canvas` | 49 files / 483 tests passed. |
| Source searches and reads of cited symbols | Support E02–E04, E09–E13; no full runtime certification. |
| CUA local browser, editor `127.0.0.1:5199`, marketing `localhost:4173` | Captured steps 1–5. Desktop 1280×720; phone 430×932. Share behavior observed; no authenticated/cloud flow tested. |

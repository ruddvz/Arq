# ARQ: complete product execution programme

Version 1.0 · Prepared 15 September 2026 · Proposed planning baseline

**Build a dependable architectural product first, prove public installation and real-world use, then expand through the full ARQ vision.** This programme expands the September 5 production plan and the live #367 product / #377 UI/UX programmes into **48 lifecycle phases and 192 outcome-and-evidence obligations**. It preserves their existing issues and ownership rather than creating a competing backlog.

The first complete product is the existing Core scope: create or trace a residential plan; author walls, doors, windows and rooms; use levels, dimensions and notes; inspect coordinated Plan/3D; produce a scaled plan sheet and vector PDF; publish a portable `.arq`; close and independently reopen it; recover safely after interruption. The mature programme adds exchange/review, a governed Agent, external-host connectors, richer documentation, visualisation, firm knowledge, site/analysis intelligence, collaboration, native platforms and an extensible professional ecosystem.

**This is a plan and an audit, not a release certification.** No product implementation, branch merge, PR/issue update, repository setting, public deployment or message to another person was made for this deliverable. The existing user checkouts were inspected without changing their work. A separate clone was used for tests and generated benchmark outputs.

## How to use this package

Start with the audit findings and next-work order below. The phase contracts are the delivery map; the searchable register preserves original source IDs and links. Each phase has four substantial obligations with its own acceptance criterion. Split those obligations into bounded implementation PRs when their prerequisites are stable; do not make a phase one giant PR.

The JSON is the editable programme dataset. The Markdown is the complete reading copy. The standalone HTML is a searchable view of both. The ZIP includes registers, reproducible generation and validation tools, selected evidence, revision history, and a provenance manifest. It runs locally without accounts, external fonts, analytics or a server.

E00–E47 are new lifecycle IDs, deliberately separate from the existing P0–P10 programme stages, UX-0–UX-8, historic ARQ-001–242 and prior S01–S44. Those original identifiers retain their meaning. A phase dependency means its exit evidence is required before the dependent phase can pass; research and contract preparation may overlap when the source issue permits it. E32 is continuing operations, not a one-time task that can be permanently finished.

## Evidence snapshot and coverage

The latest capture is **{{snapshot_time}}**. The inspected product integration snapshot is `main` at `{{main_sha}}`. GitHub still reports `{{default_branch}}` at `{{default_sha}}` as default. ADR-0029 already accepts a reversible move to `main`; #332 remains open because the operational migration/protection work is not complete.

| Inventory | Captured |
| --- | ---: |
| Remote branches | {{branches}} |
| All PRs | {{prs}}: {{open_prs}} open, {{merged_prs}} merged, {{closed_unmerged_prs}} closed without merge |
| Issues excluding PRs | {{issues}}: {{open_issues}} open |
| Issue/conversation comments | {{issue_comments}} |
| Inline review comments returned by repository endpoint | {{inline_review_comments}} |
| Historical backlog / prior production slices | 242 / 44 |
| Older implementation-pack tasks | 205 |
| Feature / command catalogue rows | 265 / 107 |
| Anticipated risks / edge cases / QA cases | 168 / 84 / 309 |
| Page / component / flow specifications | 58 / 85 / 8 |
| Workspace packages | 37 |
| Current tracked file paths / reachable commits | {{tracked_paths}} / {{all_reachable_commits}} |
| GitHub releases / tags / rulesets | 0 / 0 / 0 |

**Verified inventory:** all REST pages of repository branches, PRs, issues, comments, releases, tags, deployments and rulesets were fetched; changed-file lists and review records were captured for every PR; current checks were captured for every open PR; all branch heads were compared with the captured `main` by ancestry and changed paths. The complete reachable commit history and current tracked-path inventory are included. No unvisited pagination tail is deliberately omitted.

**Partially verified implementation:** critical storage/editor/model/command/renderer/deployment seams and relevant active PR changes were inspected; repository-wide tests and fresh typechecks were run; two real Chromium capability checks passed. All PR records and file lists were inventoried, but every historical patch line was not manually reviewed. All tracked paths were enumerated, but this is not a line-by-line audit of every file or a complete runtime test of all branches. Source inventories and keyword/category routing are labelled as such; detailed acceptance remains with the source owner.

**Not established:** a complete Core create/edit/PDF/publish/reopen workflow, production deployment provenance, a public app installer, real Safari/iPad/Pencil/VoiceOver/NVDA qualification, live backend/tenancy, penetration/load testing, architect interview completion and mature feature quality. Deleted remote branches, inaccessible external systems and private conversation attachments not present in the repository are outside the captured inventory. No absence claim extends to those sources.

## Fresh verification results

These results belong to `a02ccc69e44e41324324c9482a43edbfb58e7905` on the isolated clone. Generated benchmark images/JSON changed during tests; product source did not. They are evidence for the stated checks, not a green release gate.

| Check | Observed result | Limit |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Exit 0; pinned pnpm 9.0.0, Node 22.23.2 | No dependency upgrade performed |
| `pnpm test` | Exit 0; 360 files, 4,080 tests passed, 4 skipped | Skips remain explicit; passing libraries do not prove complete user journeys |
| `pnpm exec turbo run typecheck --force` plus contracts TypeScript check | Exit 0; 37 package tasks successful, 0 cached | Compile-time evidence only |
| `pnpm format:check` | Exit 1; eight files fail formatting | Current repository is not fully green |
| `pnpm benchmark:native-open` | Exit 0 after installing the required browser in the isolated work folder | Chromium reference open, level switching, selection and Worker teardown; does not prove editing persistence |
| `pnpm benchmark:design-system-dialog` | Exit 0; dialog/focus, tool-rail Wall, palette Wall, disabled command/reason checks | Bounded Chromium interaction evidence, not complete accessibility or authoring proof |

The earlier September 13 snapshot had 461 focused tests passing. That older result is retained as historical evidence, not substituted for the newer 4,080-test run. The first native-open attempt failed because the Playwright executable was missing; after installing it, the rerun passed. The setup failure is not classified as an ARQ product defect.

## The findings that determine the order

**F01 — Integration authority is operationally inconsistent. Verified.** `main` and the default branch have diverged; the legacy branch retains the UI master plan and a routing-index delta. Both branches report unprotected and the repository ruleset list is empty. Resolve under accepted ADR-0029 and #332, preserving all unique work. Do not combine the default switch, required-check activation and #330 repository rename into one rollback boundary. E00/E28.

**F02 — Valuable local work is outside the live integration history. Verified inventory; runtime not certified.** The primary checkout reported 211 status entries, including 84 tracked modifications, at the initial capture; the older checkout had 23 entries, including 18 tracked modifications. The primary also has `snapshot/2026-09-05-arq-working-tree`. Local additions include walls/openings/rooms, dimensions, sheets, recovery and AI experiments. Reconcile by semantic diff and proof; do not assume these changes are either obsolete or production-ready. Current status files are supplied in the evidence package. E00.

**F03 — Native persistence is still the critical integration gap. Verified in source.** `App.tsx` updates drawn walls, history and the demo journal on `main`; it does not connect those operations to the native session write queue. PR #361 addresses the bridge but is open and has failed browser/route/deployment checks. Its flat-model boundary explicitly leaves rich semantic editing to #356. The current source's flat encoder must never overwrite the rich reference model. E05/E06 before broad authoring claims.

**F04 — Tool availability and actual product reachability disagree. Verified source and issue evidence.** The command audit identifies 54 designed tool IDs, 11 with repository backing, and four active Plan tool IDs with current handlers: select, wall, pan and fit. Seven backed IDs are not wired as independently armed Plan tools. Wheel/pinch zoom and marquee behaviour can exist without proving the corresponding tool-ID path. #398's audit has closed; these runtime gaps have not disappeared. E04/E11–E19.

**F05 — Some enabled actions still produce demo history. Verified in source.** Share, account-menu and some palette paths use `recordDemoAction`, which creates a note operation. An unavailable command must not look successful or change model undo history. Fix through the canonical command owner #420 and capability ledger #370. E04.

**F06 — Visual/state authority defects are concrete, not a request for another wholesale redesign. Verified source/audit observations.** Current audits identify layered selection state, palette stacking-context risk, ad hoc overlay values and missing opener-focus restoration in touch-sheet behaviour. PR #496 owns selection evidence and #499 owns overlay contract work. Preserve their work and the brand/material/dark-mode systems; coordinate root changes with #361. E04/E10/E21.

**F07 — The full product journey is unproven despite substantial passing tests. Partially verified.** The reference-house Plan rendering was visually inspected and fresh native-open/dialog probes passed. This does not show that a new user's doors, rooms, notes and sheets persist into a downloaded file. The protected E25 journey is the primary completion test.

**F08 — Cloud and native distribution require actual implementation. Verified source inventory.** `apps/api/src/index.ts` contains `export {};`; the app directories are web, marketing and API. There is no current desktop or iPad app directory in this snapshot. Protocol/RoomPlan/MCP libraries cannot be counted as shipped services or installers. E28/E33/E44/E45.

**F09 — Release evidence and distribution are incomplete. Verified repository/API observation.** No GitHub releases or tags exist. Engineering Gate source still describes shadow mode. Live environment approval enforcement was not inspected. Several open PRs have failures; some Vercel bot comments report deployment quota limits, which are distinct from code failures. E00/E28/E30.

**F10 — Documentation state cannot safely drive execution on its own. Verified.** The routing index still says #396/#398/#403 need closure although they are now closed via #497/#502/#498. Older remaining-work notes describe already accepted ADRs as proposed. Older pack registers and STATUS contain dated evidence. Generate current capability state from exact revisions instead of carrying those assertions forward. E00/E02.

**F11 — Public-source and proprietary/confidential wording conflict. Verified observation, decision unresolved.** GitHub says public; LICENSE says proprietary/confidential, and the recorded owner decision says private/proprietary. This plan does not alter either. Resolve applicable distribution wording and legal/commercial decisions under the existing ownership rules before making public claims. E26.

**F12 — Known human/device decisions remain outside automated proof. Not-inspected/blocked for the associated claim.** Interviews, pricing/name/legal review, real Apple hardware, Firefox per-OS support and assistive-technology qualification need their own evidence. They can begin early; they cannot be closed by a generated report or browser emulation. E01/E21/E22/E26/E29.

## From the first ARQ work to the final product

| Lineage | What to preserve | What still determines completion |
| --- | --- | --- |
| July 21 founding research, master plan and monorepo | Target architect, plan-first semantic model, portable ownership, protected house workflow | Validate with actual architects rather than replacing the thesis with feature pressure |
| Original ARQ-001–242 execution and quality catalogues | Existing libraries, tests, APIs, design states, risks and command contracts | Link callers and current evidence; closed historical tasks are not blanket release proof |
| Native format, governance, language and workspace integrations | SQLite/OPFS boundary, typed operations, accepted ADRs, honest state language and design system | Preserve model data and one persistence authority through user-visible edits |
| PRs #294/#296/#298/#300/#308 and later migration #357 | Native open, lifecycle, publication, rich reference decoding and copy-on-write migration | Reconcile #361/#356, then test complete edit/publish/reopen and failure paths |
| September 5 local 44-slice plan and local implementation | Existing work and targeted verification | Preserve/rebase selectively into a controlled integration line |
| September 13–14 #367/#377 programmes and UX evidence merges | Product/UX semantic-owner map and concrete issue graph | Reuse completed audits; resolve runtime owners, defects and stage gates |
| E00–E31 | Reliable Core, architect alpha, beta and public install/access | Measured end-to-end acceptance on the distributed artefact |
| E32–E47 | Continuous quality and mature P2–P10 expansion | Each enabled feature has the same durability, safety, UX, support and distribution proof |

AOGRP 6.0, incoming blueprint revisions, generic starters and competitor reference implementations remain reference material unless accepted through current architecture ownership. Their headers cannot supersede SQLite `.arq`, current packages or accepted ADRs. The 205-item older implementation pack retains its historical evidence state but is not recertified by this plan.

## First execution order after plan adoption

| Order | Concrete work | Existing owner / dependency | Done when |
| --- | --- | --- | --- |
| 1 | Preserve local deltas; adopt a snapshot and reconcile branch/default/protection plan | #332, #330, #369, #444; E00 | Main/default histories, open PR bases and local sources have explicit dispositions |
| 2 | Repair the eight-file formatting failure and classify current PR failures | #369, #453; E00/E28 | Current baseline checks pass and each remaining failure has a reproduced cause |
| 3 | Review and complete #361 on the reconciled base | #355/#361; E06 | Native flat edit/undo/redo/publish/reopen, failure recovery and rich-model refusal pass |
| 4 | Reuse #396/#398/#403 closures; complete #401/#496 and review #412/#499 | E04/E10 | Evidence is accepted and no shared root path is concurrently owned |
| 5 | Decide canonical numerics and implement lossless semantics | #88, #464, #465, #356; E03/E05 | Rich models preserve identity/dependants through intended edits and round trips |
| 6 | Unify commands, selection and persistence UX | #420/#425/#427, #371/#459/#460 | Availability is truthful; cancelled/failed actions cannot fake saved state |
| 7 | Deliver complete vertical authoring slices | #374/#378/#380/#382/#385/#387 and paired UX children | Each slice is reachable, durable, undoable and coordinated in Plan/3D/PDF |
| 8 | Qualify one plan sheet and the protected Core workflow | #393/#395/#406/#476 | End-to-end creation, export, independent reopen and failure recovery pass |
| 9 | Run platform/accessibility/performance and architect acceptance | #359/#360/#400/#402/#408, E21–E30 | Required human/device evidence and beta exit criteria are met |
| 10 | Publish stable Core through the chosen public install/access path | #453, E31 | Clean-machine user journey, rollback, support and observed rollout pass |

This order is a dependency frontier, not a request to start ten owners on shared files. E01 research and E26 decisions can progress while integration is repaired. Component work can progress after contracts and paths are assigned. `App.tsx`, native session/schema, command/selection stores and shared tokens are serial ownership resources.

## Release gates and what “downloadable” means

| Gate | Required evidence | Stop conditions |
| --- | --- | --- |
| G0 — controlled baseline | E00–E04 applicable contracts; branch/ownership truth; current check baseline | Unknown integration authority, lost local work, misleading capability ledger |
| G1 — safe internal Core | E05–E25; full protected journey; parser and durability failures | Silent data loss, semantic flattening, wrong-project write, false save, critical unreachable commands |
| G2 — architect alpha | G1 plus necessary E26 controls, support and accepted device envelope | Missing recovery escape path, P0/P1, insufficient privacy/support controls |
| G3 — accepted alpha baseline | E29; observed architect tasks; fixes; current CTO review | Unresolved critical workflow or trust failures, missing human evidence |
| G4 — public beta / release candidate | E27/E28/E30; candidate freeze; channel/upgrade/rollback evidence | Missing public install/access path, mixed-build assets, unresolved scoped P0/P1, failed critical tests |
| G5 — stable Core GA | E31; clean-machine public path, measured reliability window, support, current artefact manifest | Public artefact differs from tested build; rollout thresholds regress |
| G6 — each mature capability stage | P2–P10 source gate plus paired UX, security, reliability and distribution evidence | New surface bypasses canonical operations, revision identity, consent, file safety or support |
| G7 — mature programme handoff | E47 plus explicit accepted scope and all required channels | Any promised capability/installer is unsupported or any deferred work is hidden |

The current repository is web-first and has no native app implementation. **A portable `.arq` download is not an application installer.** E28 must make the product/channel decision explicit. A browser release is acceptable only when described as browser access. An installable web app counts only after real install/offline/update/uninstall qualification. If the launch promise includes macOS, Windows or native iPad downloads, the corresponding E45/E44 gate becomes a dependency of that launch; a browser build cannot silently satisfy it. Desktop tooling choice remains an ADR/spike, not a preselected Tauri commitment.

Web delivery must verify the public `/app` route, correct Worker/WASM loading, cache versioning, clean first-run, offline recovery and upgrade during active work. Native delivery adds signing/notarisation or platform equivalents, store/installer policies, associations, updater authenticity, clean-machine testing and data-preserving uninstall. Revalidate current requirements using [Tauri distribution documentation](https://tauri.app/distribute/) if that toolkit is selected and [Apple's review guidelines](https://developer.apple.com/app-store/review/guidelines/) for the iPad channel.

## Quality targets without a false perfection claim

“99.99% of bugs gone” has no measurable denominator: unknown bugs cannot be counted. The goal is **zero known release-stopping defects and increasingly strong measured reliability in the supported product envelope**. Coverage counts measure planning completeness, not product maturity.

| Measure | Proposed acceptance policy | Evidence required |
| --- | --- | --- |
| Committed-data integrity | Zero known silent corruption/loss, wrong-project writes or destructive migrations at every public stage | Deterministic failure injection, golden round trips, fuzzing and incident history |
| P0/P1 defects | Zero open within the advertised release scope | Reproductions, severity decisions, regression tests and integrated retests |
| Protected Core journey | Every required workflow/failure row passes | Exact build, project fixture, browser/device and artefact evidence |
| Crash-free supported sessions | Candidate target ≥99.9% in beta; long-term ≥99.99% after sufficient representative data | Defined session denominator, versions/cohorts, window and confidence interval; targets require owner calibration |
| Save/publish/reopen success | Candidate long-term target ≥99.99% for valid supported attempts | Count write and delivery separately; disclose user cancellations, invalid inputs, retries and infrastructure errors separately |
| Service availability, if cloud enabled | Choose SLO by service and cost; 99.99% is an optional mature target, not a present promise | Request/minute-based denominator, dependency scope, maintenance policy, probes and error budget |
| Usability | Proposed ≥90% unassisted protected-task completion after brief onboarding; every participant can make/reopen a portable copy | Predefined task/rubric, assistance log and representative cohort |
| Accessibility | Applicable WCAG 2.2 AA and complete keyboard/assistive critical journey | Automated checks plus human assistive-technology evidence |
| Performance | Existing budgets plus approved p95/p99 and memory ceilings | Physical-device measurements on the protected model and larger limit fixtures |

For an illustrative independent Bernoulli model with zero failures, approximately **29,956 representative attempts** are needed for a one-sided 95% lower confidence bound of 99.99% success (`0.05^(1/n) ≥ 0.9999`). Repeated identical CI runs are not representative independent field evidence. Four nines of time-based availability permits about **4.32 minutes** of unavailability per 30-day month. Neither calculation guarantees geometry correctness or describes bugs eliminated.

Existing performance targets are local interactive ≤2 s; selection median ≤50 ms; hover median ≤32 ms; wall commit median ≤100 ms; room recalculation and undo median ≤150 ms; journal and palette ≤100 ms; PDF ≤5 s; pan/zoom and orbit target 60 FPS. The repository explicitly calls these planning targets. Preserve the 150-wall, 80-opening, 60-room, 200-annotation, one-underlay, two-level reference model and record device/workload details. Do not invent percentile or memory passes from these medians.

The accessibility target includes meaningful canvas alternatives, keyboard focus, non-drag routes and status announcements; see [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/). Storage qualification must account for quota and eviction, not assume browser storage is a backup; see [MDN's storage quota and eviction guidance](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## Defect severity and stop rules

| Severity | ARQ example | Release consequence |
| --- | --- | --- |
| P0 | Committed data loss/corruption, cross-project/tenant write or disclosure, unrecoverable migration, unsafe Agent bypass | Stop rollout; contain/recover; fix and prove regression before resuming |
| P1 | Core tool or save/export path blocked; wrong scaled PDF; stale coordinated model; inaccessible critical action; crash in a supported routine workflow | Blocks the affected public release scope |
| P2 | Significant workaround exists; noncritical interaction/performance regression | Owner disposition with workaround, deadline and user impact; not silently ignored |
| P3 | Minor visual/copy issue without functional ambiguity | Prioritise by frequency and polish; keep out of data-integrity triage |
| P4 | Enhancement or refinement | Evaluate against real demand and capacity |

These are proposed operational definitions to codify in #453. Never downgrade a data-safety defect because it is hard to fix. An enabled feature with a known P1 cannot be declared complete by waiving its tests. Scope exclusion requires a deliberate product decision and matching UI/public wording. Risk catalogue entries stay anticipated risks unless reproduced.

## Universal feature contract

Every delivered capability must satisfy REQ-01–REQ-16 below or carry a justified non-applicability decision. A passing unit test or merged PR alone satisfies none of the composite release gates.

| ID | Required contract |
| --- | --- |
| REQ-01 | Defined user outcome, release scope, source owner and current acceptance criteria |
| REQ-02 | Reachable UI/command routes with correct enabled/disabled/permission reasons |
| REQ-03 | Canonical semantic model, IDs, units and versioned compatibility preserved |
| REQ-04 | Typed validation and atomic mutation; invalid/cancelled work changes no committed state |
| REQ-05 | Deliberate undo/redo grouping and correct inverse/dependency handling |
| REQ-06 | Durability acknowledgement, project/revision identity, publish and independent reopen |
| REQ-07 | Crash/quota/corruption/migration recovery and a usable portable escape path |
| REQ-08 | Plan/3D/tree/inspector/sheet/Agent projections agree on the intended revision |
| REQ-09 | Empty/loading/success/invalid/error/read-only/offline/recovery states and truthful wording |
| REQ-10 | Keyboard, screen reader, touch/pen, zoom, contrast and reduced-motion requirements |
| REQ-11 | Workload/device-bound performance, cancellation/backpressure and resource cleanup |
| REQ-12 | Untrusted-input, permission, privacy, secret and supply-chain controls |
| REQ-13 | Happy-path, negative, property/golden, integration, browser and applicable physical tests |
| REQ-14 | Exact-source/build evidence, review, CI, versioning, compatible rollout/rollback |
| REQ-15 | Documentation, telemetry/support, public claims and distribution path match reality |
| REQ-16 | Known defects, decisions, human evidence and deferred work stay visible and owned |

## Mandatory failure campaigns

| Campaign | Cases | Required outcome / phases |
| --- | --- | --- |
| Identity and transactions | Duplicate names, wrong project, stale revision, failed write, late Worker reply, rapid undo while saving | No cross-write/partial commit/false success; E05–E08 |
| File safety | Corrupt/truncated/foreign SQLite, WAL-only changes, old/new schemas, interrupted migration, resource exhaustion | Source unchanged, explicit refusal or verified recoverable copy; E07/E09 |
| Lifecycle | Browser crash, quota denial/eviction, A→B→A, repeated opens, close/publish while writes queue | Recovery provenance, bounded workers/memory, correct final revision; E07/E23 |
| Geometry | Large/small coordinates, near-coincident edges, wall joins, host split/delete, invalid rooms, broken dimensions | Deterministic validation and no orphan references; E03/E11–E16 |
| Rendering/document | Stale caches, WebGL loss, wrong level, clipping/fonts, print scale, missing content | Canonical model retained; supported outputs agree and failures are explicit; E18/E20 |
| Input/accessibility | IME, decimal locale, touch/pen cancel, focus traps, keyboard popup, 200% zoom, hidden selection | No accidental mutation or blocked critical route; E04/E21/E22 |
| Exchange | Mixed units/origins, unsupported entities, malicious image/PDF/IFC/DXF, cancelled staging | Fidelity/loss report and unchanged project on failure; E15/E34 |
| Cloud/review | Expiry/revocation, cross-tenant reads, retries, out-of-order events, partitions, restore | Server-enforced access and honest conflict/durability states; E33/E35/E43 |
| Agent/connectors | Prompt injection, stale proposal, wrong host document, denied grant, interrupted apply | Fail closed, typed operations, explicit review, grouped undo and verified result; E36–E38 |
| Delivery/update | Mixed Worker/assets, broken public route, tampered installer, interrupted update, incompatible rollback | Last compatible project remains recoverable; install claims match tested artefacts; E28/E31/E44/E45 |

The CSV registers preserve every original risk/QA row. Some older rows use generic acceptance wording; E25 must replace that with concrete fixtures, stimuli and assertions before counting it as executable coverage. Excluding a row requires stage/applicability rationale, not deletion.

## Ownership, capacity and sequencing

Use the existing Zeus roles as accountable technical owners; assign actual people when each phase activates. Product, legal/commercial and architect reviewers are additional decision contributors, not invented named staff. The release owner accepts scope and gates; the domain owner signs semantic correctness; QA signs evidence; accessibility/security specialists sign their relevant claims; #369 reconciles the integrated product.

Finish one durable vertical slice before spreading work across many tools. A practical initial work-in-progress limit is one root integration owner plus independent research/decision and package-contract lanes. More contributors help only where files and interfaces are independent. After roughly three to five merged lanes, a contract change, a cross-lane regression, a phase gate or a snapshot older than seven days, run the existing #369 reconciliation process. #467 can automate checkpoint preparation later; this deliverable does not schedule an automation.

The primary critical path is E00 → E02/E03 → E05/E06/E07/E08 → complete authoring and coordinated documentation E11–E20 → E21–E25 → E29 → E30 → E31. Research, security and distribution decisions start early and must complete at their named gates. P2 depends on accepted alpha; Agent depends on stable exchange/revision identity; Connect depends on the native Agent gate. Native platform work may be prepared after stable Core and physical evidence, without forcing every unrelated mature feature to finish first.

Do not publish a calendar based on 48 phase labels. After E00, estimate each ready slice with optimistic/likely/pessimistic effort, available role capacity, external lead time, integration/test time and contingency. Reforecast from the first two completed vertical slices. Human recruitment, unresolved units, backend architecture and native signing/store access are separate lead-time risks. The dependency graph is enforceable now; dates require capacity and acceptance decisions that are not yet evidenced.

## Decision register and missing inputs

| Decision | Owner | Due gate | Planning default / constraint |
| --- | --- | --- | --- |
| D01 Integration/default/protection and rename sequence | Repository/release owner | G0 | Implement accepted ADR-0029 reversibly; retain both histories; #330 is separate |
| D02 Primary/older local change disposition | Integration owner | G0 | Preserve first, compare, port selectively; never blanket-reset |
| D03 Canonical units/tolerance/subreference semantics | Geometry/product architecture | Before E05/authoring | Complete #88/#464/#465; no incidental migration |
| D04 Supported browsers, OS, project size and phone scope | Product/platform/QA | G2, final G4 | Published support only for measured rows; real-device gates stay open |
| D05 Web/PWA/native downloadable channels | Product/release owner | E28, before G4 | Web first is current direction; native claims require E44/E45 |
| D06 Name, legal owner, visibility/licence and distribution terms | Owner with qualified legal review | Applicable public launch gate | Existing proprietary terms are not changed by this plan |
| D07 Cloud regions/providers, retention, backup and RPO/RTO | Security/operations/product | Before E33 public use | Local authoring and portable ownership survive cloud failure |
| D08 Pricing/billing/support capacity | Product/commercial/operations | Before paid/public GA | No invented price or cost model; #217/#218 |
| D09 AI providers/models/data retention and spend caps | AI/security/product | Before E36 | Read-only first, approved scoped data access, typed proposals |
| D10 Jurisdiction packs and professional review | Product/domain expert | Before E42 rule claims | No universal compliance thresholds from room labels |
| D11 Connector 0 and host support matrix | Product/connectors/security | E38 | Evidence-based bake-off, current host APIs and licences |
| D12 Mature scope and deferred catalogue disposition | Product/release owner | G6/G7 | Revalidate P10 candidates; do not promise every historical proposal |

None of these decisions is silently resolved by writing this plan. They are scheduled inputs with due gates; useful independent work can continue while they are open.

## Maintenance, evidence and handoff

Adopt the package into the repository through existing #444 and connect the dataset to #370; the local planning book is not a substitute for that future reviewed integration. Keep the 48 phase IDs, 192 obligation IDs and original source IDs stable. New work receives new IDs; retired work keeps a tombstone with rationale and successor. A closed GitHub issue updates recorded issue state, never automatically the capability evidence state.

Every execution handoff must name the current branch/SHA, issue and E-phase obligation, owned paths/interfaces, dependencies, user outcome, failure cases, intended checks, known decisions and delivery stop. On completion, record exact commands, exit codes, fixture/device versions, artefact hashes, review, remaining gaps and rollback. This is a template for future work, not a dispatched assignment.

Refresh GitHub before a new implementation batch or gate. Recompare branch heads and active PR ownership, reread changed issue contracts/comments, refresh local-delta disposition and invalidate affected evidence. Regenerate the HTML/Markdown/CSV from the JSON and validate IDs, references, acyclic dependencies and full snapshot coverage. The included manifest detects accidental edits; it does not establish live freshness by itself.

The critique pass for this package checks for duplicate programme authority, stale closures, skipped native installation, speculative late-stage promises, false “verified” carryover, missing human evidence, calendar precision and unsupported reliability claims. This was a single-agent review; no independent reviewer was fabricated. A future independent technical/product review is required before adopting the plan as repository control authority or passing release gates.

The deliverable is complete as a **proposed execution programme with measured inventory coverage**. Product completion is the gated work ahead: dependable architectural continuity, public distribution that matches its promise, and sustained evidence that users can trust their files.

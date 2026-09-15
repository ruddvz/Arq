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

The latest capture is **2026-09-15T13:06:52.349106+00:00**. The inspected product integration snapshot is `main` at `a02ccc69e44e41324324c9482a43edbfb58e7905`. GitHub still reports `claude/arq-cad-platform-research-ba8rav` at `df04288c182bdfcee91f92e70b0e5d0017fc0628` as default. ADR-0029 already accepts a reversible move to `main`; #332 remains open because the operational migration/protection work is not complete.

| Inventory | Captured |
| --- | ---: |
| Remote branches | 100 |
| All PRs | 94: 25 open, 51 merged, 18 closed without merge |
| Issues excluding PRs | 408: 146 open |
| Issue/conversation comments | 244 |
| Inline review comments returned by repository endpoint | 0 |
| Historical backlog / prior production slices | 242 / 44 |
| Older implementation-pack tasks | 205 |
| Feature / command catalogue rows | 265 / 107 |
| Anticipated risks / edge cases / QA cases | 168 / 84 / 309 |
| Page / component / flow specifications | 58 / 85 / 8 |
| Workspace packages | 37 |
| Current tracked file paths / reachable commits | 2825 / 925 |
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


# Detailed phase contracts

## E00 · Repository truth and integration recovery
Stage: P0 · Accountable role: executor · State: proposed; gate not evaluated

Dependencies: None; first integration control phase.

Existing issues: [#332](https://github.com/ruddvz/Arq/issues/332), [#330](https://github.com/ruddvz/Arq/issues/330), [#317](https://github.com/ruddvz/Arq/issues/317), [#319](https://github.com/ruddvz/Arq/issues/319), [#325](https://github.com/ruddvz/Arq/issues/325), [#364](https://github.com/ruddvz/Arq/issues/364), [#368](https://github.com/ruddvz/Arq/issues/368), [#369](https://github.com/ruddvz/Arq/issues/369), [#370](https://github.com/ruddvz/Arq/issues/370), [#444](https://github.com/ruddvz/Arq/issues/444), [#467](https://github.com/ruddvz/Arq/issues/467)

Prior slices: S01, S27, S30

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E00-O01
Reconcile main and the legacy default at exact SHAs using ADR-0029; preserve both histories, retarget PRs deliberately and separate repository rename from product naming.

**Acceptance:** Accepted integration record, no lost changes, CI/deployment sources agree, rollback rehearsed before any old branch is retired.

## E00-O02
Inventory primary and older dirty trees, snapshot branch, all remote heads and unmerged patches; hash candidate files and assign a disposition to every branch.

**Acceptance:** Each delta is retained, integrated, superseded with evidence, or intentionally deferred; no blanket reset or bulk merge.

## E00-O03
Close the current formatting failure and triage failed PR checks by cause; preserve #361 App.tsx, #363 browser, #365 graph, #495 marketing, #496 selection evidence and #499 overlay ownership.

**Acceptance:** Candidate checks pass on the reconciled revision; a docs-only failure, environment failure and product regression remain separately identified.

## E00-O04
Adopt this package through #444/#370, link requirements and refresh the capability ledger, ownership protocol and CTO checkpoint.

**Acceptance:** No unowned source record; current integration SHA, capability evidence and next safe frontier are generated without declaring features complete from issue state.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E01 · Founding product thesis and architect research
Stage: P0 + P1A · Accountable role: product-architecture · State: proposed; gate not evaluated

Dependencies: E00

Existing issues: [#36](https://github.com/ruddvz/Arq/issues/36), [#37](https://github.com/ruddvz/Arq/issues/37), [#38](https://github.com/ruddvz/Arq/issues/38), [#211](https://github.com/ruddvz/Arq/issues/211), [#408](https://github.com/ruddvz/Arq/issues/408)

Prior slices: S01, S33

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E01-O01
Reconstruct the July 21 thesis and interview evidence; validate independent architects and small residential practices as the first audience.

**Acceptance:** Interview notes distinguish observed pain, frequency, existing workaround and willingness to change; unperformed interviews remain pending.

## E01-O02
Run the two six-architect interview rounds and hands-on competitor workflow benchmark; use identical residential tasks and record constraints.

**Acceptance:** Twelve sessions are targeted by existing issues; recruit mix and consent are recorded, and benchmark results are observations rather than borrowed marketing claims.

## E01-O03
Define the protected two-level house journey and test first-wall, first-correct-sheet, portable reopen and recovery comprehension.

**Acceptance:** Task scripts and success measures are approved before alpha, with baseline timings and assistance recorded.

## E01-O04
Maintain an adopt/adapt/defer/reject research ledger for Pascal, Archaiflow and AI architecture comparisons.

**Acceptance:** Every adopted suggestion has user evidence, provenance, licence review where relevant, affected contract and an existing owner; no competitor feature automatically becomes scope.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E02 · Capability contracts and release boundaries
Stage: P0 · Accountable role: product-architecture · State: proposed; gate not evaluated

Dependencies: E00

Existing issues: [#367](https://github.com/ruddvz/Arq/issues/367), [#372](https://github.com/ruddvz/Arq/issues/372), [#373](https://github.com/ruddvz/Arq/issues/373), [#377](https://github.com/ruddvz/Arq/issues/377), [#370](https://github.com/ruddvz/Arq/issues/370), [#444](https://github.com/ruddvz/Arq/issues/444), [#453](https://github.com/ruddvz/Arq/issues/453), [#452](https://github.com/ruddvz/Arq/issues/452)

Prior slices: S01, S23, S27

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E02-O01
Map every promised feature to UI entry, command, typed operation, storage, derived views, tests, support documentation and release stage.

**Acceptance:** The 265 feature-catalogue rows retain their original stages and status; unsupported, research-only and shipped are distinct.

## E02-O02
Preserve Core Release 1, Exchange Release 2, bounded AI/documentation Release 3 and native value Release 4 while mapping the newer P0-P10 trajectory.

**Acceptance:** A signed scope baseline names required and excluded features for each release; the new E-phases do not silently change those commitments.

## E02-O03
Unify product and UX ownership from #493: semantic owners supply operations; UX issues expose and test them.

**Acceptance:** Walls, openings, rooms, dimensions, notes, levels, sheets, Agent and selection each have one authority and a shared completion gate.

## E02-O04
Define versioned interface and compatibility contracts, stable requirement IDs and evidence freshness.

**Acceptance:** Unknowns have decision IDs, owners and due gates; proposed ADRs cannot be cited as accepted, and changes invalidate dependent evidence.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E03 · Units, coordinates and tolerance decisions
Stage: P0 + P1 · Accountable role: geometry-bim · State: proposed; gate not evaluated

Dependencies: E02

Existing issues: [#88](https://github.com/ruddvz/Arq/issues/88), [#464](https://github.com/ruddvz/Arq/issues/464), [#452](https://github.com/ruddvz/Arq/issues/452), [#465](https://github.com/ruddvz/Arq/issues/465)

Prior slices: S13

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E03-O01
Complete the canonical-unit spike with metric/imperial, extreme coordinates, import origins, round trips and TS/Rust parity.

**Acceptance:** ADR-0004 and the decision register record measured alternatives, selected representation, limits and migration impact.

## E03-O02
Separate canonical storage, display units, decimal locale, snapping distance, topological tolerance and rendering precision.

**Acceptance:** Unit/locale changes do not change the building; NaN, infinity, overflow and invalid scales are refused without a commit.

## E03-O03
Calibrate the tolerance ladder for point equality, intersection, joins, room closure, minimum openings and export precision.

**Acceptance:** Boundary/property fixtures cover both sides of each threshold and produce stable results across supported execution engines.

## E03-O04
Version IDs and semantic subreferences for edges, faces, hosts, dimensions, review anchors and Agent proposals.

**Acceptance:** References survive supported edits and become explicitly invalid when topology changes; no index-based silent retargeting.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E04 · Commands, tools, selection and focus authority
Stage: P0 + UX-0/2 · Accountable role: editor-interaction · State: proposed; gate not evaluated

Dependencies: E02

Existing issues: [#396](https://github.com/ruddvz/Arq/issues/396), [#398](https://github.com/ruddvz/Arq/issues/398), [#401](https://github.com/ruddvz/Arq/issues/401), [#403](https://github.com/ruddvz/Arq/issues/403), [#405](https://github.com/ruddvz/Arq/issues/405), [#420](https://github.com/ruddvz/Arq/issues/420), [#423](https://github.com/ruddvz/Arq/issues/423), [#425](https://github.com/ruddvz/Arq/issues/425), [#427](https://github.com/ruddvz/Arq/issues/427), [#429](https://github.com/ruddvz/Arq/issues/429)

Prior slices: S02, S09

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E04-O01
Reuse merged #396/#398/#403 audit evidence, finish #401 through PR #496, and verify current command/selection evidence before broad shell changes.

**Acceptance:** Every CMD catalogue item is runnable, deliberately unavailable with a reason, or later-stage; no invented command succeeds through a demo note.

## E04-O02
Create one metadata/dispatch contract for palette, toolbar, shortcuts and context menus, with capability and permission checks.

**Acceptance:** The same command produces the same result from every entry; Share and Account never add model undo history when unavailable.

## E04-O03
Unify selected set, primary item, active tool, active level/view and keyboard focus across Plan, 3D, tree and inspector.

**Acceptance:** Hidden/locked/deleted targets, multi-selection and primary-selection transitions are covered by deterministic and browser tests.

## E04-O04
Standardise pointer capture, preview, exact entry, Enter, Escape, cancel, focus restoration and grouped undo.

**Acceptance:** Cancel leaves canonical state unchanged; IME/editable fields do not fire global shortcuts; modal and tool transitions restore useful focus.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E05 · Lossless canonical model and typed operations
Stage: P0 + P1 · Accountable role: geometry-bim · State: proposed; gate not evaluated

Dependencies: E03

Existing issues: [#356](https://github.com/ruddvz/Arq/issues/356), [#389](https://github.com/ruddvz/Arq/issues/389), [#465](https://github.com/ruddvz/Arq/issues/465)

Prior slices: S03, S04

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E05-O01
Implement the reference-model writer and typed semantic mutations over existing BIM contracts.

**Acceptance:** Rich fixtures retain untouched levels, types, rooms, openings, placed content, services, pathways, views and metadata after edit/publish/reopen.

## E05-O02
Define create/update/delete and inverse contracts with explicit project, revision, element, level and type identity.

**Acceptance:** Missing identities and stale revisions fail before mutation; flat models never silently replace rich reference models.

## E05-O03
Make validation and dependency policy explicit for hosted objects, rooms, dimensions, views and future plugins.

**Acceptance:** Delete, move, split and type edits either preserve/recompute dependants or refuse with a useful explanation; no dangling references.

## E05-O04
Generate invalidation from committed semantic changes to plan, model, tree, inspector and documents.

**Acceptance:** Every consumer converges on one revision; renderer state and cached meshes never become project truth.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E06 · Durable editor transactions and portable publication
Stage: P0 + UX-5 · Accountable role: arqfs-recovery · State: proposed; gate not evaluated

Dependencies: E05

Existing issues: [#355](https://github.com/ruddvz/Arq/issues/355), [#371](https://github.com/ruddvz/Arq/issues/371), [#397](https://github.com/ruddvz/Arq/issues/397), [#459](https://github.com/ruddvz/Arq/issues/459), [#460](https://github.com/ruddvz/Arq/issues/460), [#469](https://github.com/ruddvz/Arq/issues/469)

Prior slices: S04, S05, S06

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E06-O01
Finish and reconcile PR #361's native persistence bridge; keep demo journaling scoped to no-native-project mode.

**Acceptance:** Forward edit, undo and redo use the existing native session queue; read-only and unsupported reference writes fail honestly.

## E06-O02
Commit typed operations, inverse/history and durable revision metadata with acknowledgement semantics.

**Acceptance:** Failures before/during/after a Worker write never create partial canonical commits or a false saved state; subsequent valid work can recover.

## E06-O03
Consolidate Save a copy and Publish into one snapshot/checkpoint/export/fresh-reader verification path.

**Acceptance:** Identity, revision, checksums, semantic equivalence and absence of WAL/SHM dependencies are checked before portable bytes are delivered.

## E06-O04
Handle queued edits during publish/close/project switching, cancelled download and failed file delivery.

**Acceptance:** A later edit is not falsely included in an earlier copy; delivery cancellation does not advance the delivered-copy state or overwrite the source file.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E07 · Migration, recovery and storage pressure
Stage: P1 + UX-5 · Accountable role: arqfs-recovery · State: proposed; gate not evaluated

Dependencies: E06

Existing issues: [#397](https://github.com/ruddvz/Arq/issues/397), [#399](https://github.com/ruddvz/Arq/issues/399), [#446](https://github.com/ruddvz/Arq/issues/446), [#461](https://github.com/ruddvz/Arq/issues/461), [#462](https://github.com/ruddvz/Arq/issues/462), [#463](https://github.com/ruddvz/Arq/issues/463)

Prior slices: S08, S25

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E07-O01
Revalidate merged #357 copy-on-write migration through the current UI, preserving source bytes and quarantining failed copies.

**Acceptance:** Old/new schema, truncated file, wrong application ID, interrupted migration and sidecar-dependent files each produce the correct refusal or recoverable copy.

## E07-O02
Prove crash and restart recovery across edits, close, publish, Worker termination and browser shutdown.

**Acceptance:** Recovery identifies project, source revision, recovered revision and losses; restore/discard is inspectable and never destroys the only good copy.

## E07-O03
Add quota, eviction, denied persistence, full disk and low-memory pressure handling with an export escape path.

**Acceptance:** Local working copy, recovery journal and independent portable backup are distinct in UI; storage failure cannot report saved.

## E07-O04
Enforce single-writer identity across tabs, duplicate filenames, stale replies and A→B→A switching.

**Acceptance:** Wrong-project writes are impossible in injected races; lock acquisition/release and abandoned-session recovery have bounded outcomes.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E08 · New, open, recent and project lifecycle
Stage: P1 · Accountable role: arqfs-recovery · State: proposed; gate not evaluated

Dependencies: E07

Existing issues: [#374](https://github.com/ruddvz/Arq/issues/374), [#450](https://github.com/ruddvz/Arq/issues/450), [#404](https://github.com/ruddvz/Arq/issues/404)

Prior slices: S07, S08

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E08-O01
Create a real native project from New with project identity, units, initial level, naming and useful sample choices.

**Acceptance:** A newly created project can be edited, exported, closed and independently reopened without first importing an existing file.

## E08-O02
Support open, recent, rename, duplicate and close with explicit unsaved/in-flight-write decisions.

**Acceptance:** Recents are scoped to recoverable identities; duplicate creates a new identity; stale entries provide a safe path rather than an empty shell.

## E08-O03
Design archive/delete/restore and retention for local ownership first and later cloud ownership separately.

**Acceptance:** Destructive actions explain affected copies, preserve recoverability where promised and cannot delete a different project's resources.

## E08-O04
Make first-run, unsupported-version, no-project and recovery entry states discoverable.

**Acceptance:** A novice can find New/Open/sample and explain where work is stored without knowing OPFS, SQLite or Worker terminology.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E09 · Security and supply-chain foundations
Stage: P0 + P1 · Accountable role: security · State: proposed; gate not evaluated

Dependencies: E02

Existing issues: [#446](https://github.com/ruddvz/Arq/issues/446), [#216](https://github.com/ruddvz/Arq/issues/216), [#453](https://github.com/ruddvz/Arq/issues/453)

Prior slices: S25, S29

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E09-O01
Threat-model untrusted .arq/SQLite/archive, images/PDF, DXF/IFC, scripts, Worker messages and remote links.

**Acceptance:** Parser size, expansion, nesting, entity, CPU and time limits are enforced; cancellation terminates expensive work and leaves committed data unchanged.

## E09-O02
Review origin isolation, CSP, navigation/URL handling, dependency licence inventory and secret boundaries.

**Acceptance:** No exploitable critical/high finding remains in enabled shipping paths; malformed fixtures and injection attempts fail safely.

## E09-O03
Inventory dependencies, pinned toolchains, SBOM, notices, native libraries, model weights and update provenance.

**Acceptance:** Each shipped artefact has a reproducible dependency bill and reviewed distribution obligations; dependency PRs are upgraded in compatible groups with regression evidence.

## E09-O04
Create vulnerability intake, advisory, patch and compromised-release procedures.

**Acceptance:** A tabletop exercise assigns containment, disclosure, revoked credentials/artefacts and recovery to named owners; no fabricated security certification.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E10 · Visual system and canvas-first shell
Stage: UX-1 · Accountable role: ui-visual · State: proposed; gate not evaluated

Dependencies: E04

Existing issues: [#205](https://github.com/ruddvz/Arq/issues/205), [#407](https://github.com/ruddvz/Arq/issues/407), [#409](https://github.com/ruddvz/Arq/issues/409), [#412](https://github.com/ruddvz/Arq/issues/412), [#418](https://github.com/ruddvz/Arq/issues/418), [#403](https://github.com/ruddvz/Arq/issues/403)

Prior slices: S09, S10

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E10-O01
Preserve brand.v4, shell tokens, functional material and dark appearance authority; reconcile portal typography, icon gaps and local constants.

**Acceptance:** Shared surfaces consume owned tokens; arbitrary values have documented geometric or optical reasons.

## E10-O02
Define desktop panel resize/collapse/docking/reopen and overlay exclusion zones before root composition.

**Acceptance:** Menus, dialogs, tool HUD, toasts and drawers have predictable stacking; no control or error message covers a critical action.

## E10-O03
Implement root shell composition only after #361 ownership is resolved; separate reusable state primitives from root wiring.

**Acceptance:** Useful canvas space remains at supported viewport sizes, and empty/loading/read-only/error states have one clear next action.

## E10-O04
Review light/dark, increased contrast, reduced transparency, 200% zoom and long/localised text at real DPRs.

**Acceptance:** Visual diffs are explained, focus/disabled/selected states remain distinct and baselines are never reset merely to hide regressions.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E11 · Complete wall authoring and editing
Stage: P1 + UX-3 · Accountable role: geometry-bim · State: proposed; gate not evaluated

Dependencies: E04, E05, E06, E10

Existing issues: [#378](https://github.com/ruddvz/Arq/issues/378), [#431](https://github.com/ruddvz/Arq/issues/431), [#433](https://github.com/ruddvz/Arq/issues/433), [#435](https://github.com/ruddvz/Arq/issues/435)

Prior slices: S14

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E11-O01
Deliver straight-wall drawing with exact length/angle, chaining, live snapping and typed semantic context.

**Acceptance:** Preview and committed geometry agree; zero-length, duplicate, out-of-range and cancelled segments leave state unchanged.

## E11-O02
Complete endpoints, reshape, move, copy, rotate, mirror, trim, extend, split and offset within declared Core support.

**Acceptance:** Unsupported modifiers are disabled; valid changes preserve identity and form a deliberate undo group.

## E11-O03
Resolve butt, mitre, T and cross joins, wall thickness/type and intersections with one tolerance policy.

**Acceptance:** Adversarial join fixtures are deterministic and plan/3D/PDF show equivalent geometry without inverted solids or gaps.

## E11-O04
Propagate wall edits to hosted openings, rooms, dimensions and dependent drawings.

**Acceptance:** Delete/split/reshape has an explicit dependency result, survives portable reopen and never silently detaches an opening or measurement.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E12 · Hosted openings, doors and windows
Stage: P1 + UX-3 · Accountable role: geometry-bim · State: proposed; gate not evaluated

Dependencies: E11

Existing issues: [#380](https://github.com/ruddvz/Arq/issues/380), [#437](https://github.com/ruddvz/Arq/issues/437), [#439](https://github.com/ruddvz/Arq/issues/439), [#441](https://github.com/ruddvz/Arq/issues/441)

Prior slices: S15

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E12-O01
Wire door and window placement to valid host wall/level/type with snapped preview and host highlighting.

**Acceptance:** Off-wall, too-wide, out-of-bounds and overlapping placements refuse before commit.

## E12-O02
Expose door hand, side and swing plus window width, height and sill with exact numeric entry.

**Acceptance:** Inspector and direct controls agree; type/instance and mixed-selection edits are clear and atomic.

## E12-O03
Maintain openings during wall reversal, movement, split, thickness changes and deletion.

**Acceptance:** Deterministic host remap/cascade/refusal policy prevents orphan references and geometric overlap.

## E12-O04
Prove plan symbols, 3D cutouts, schedules where enabled, PDF and reopened archive agreement.

**Acceptance:** Rich fixture round trips retain all unaffected entities; undo/redo restores exact host and infill relationships.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E13 · Rooms, topology and areas
Stage: P1 + UX-3 · Accountable role: geometry-bim · State: proposed; gate not evaluated

Dependencies: E11, E12

Existing issues: [#382](https://github.com/ruddvz/Arq/issues/382), [#443](https://github.com/ruddvz/Arq/issues/443)

Prior slices: S16

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E13-O01
Connect room placement/detection to the canonical boundary graph and active level.

**Acceptance:** Bounded, unbounded, nested, concave and self-intersecting cases report accurate topology rather than a plausible fill.

## E13-O02
Provide gap diagnostics, zoom-to-problem, room identity/name/number and area display.

**Acceptance:** A user can find and repair a near-gap; exact area definitions and units are documented.

## E13-O03
Recompute rooms after host changes with incremental invalidation and stable identity policies.

**Acceptance:** Splits/merges/deleted boundaries never leave stale labels, quantities or orphan room references.

## E13-O04
Validate geometry and usability against independent hand-calculated fixtures and real plans.

**Acceptance:** Holes, slivers, near-coincident edges and extreme scales produce deterministic area or actionable refusal; no building-code compliance claim.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E14 · Levels, types and building hierarchy
Stage: P1 + UX-4 · Accountable role: geometry-bim · State: proposed; gate not evaluated

Dependencies: E05, E06, E10

Existing issues: [#374](https://github.com/ruddvz/Arq/issues/374), [#451](https://github.com/ruddvz/Arq/issues/451), [#454](https://github.com/ruddvz/Arq/issues/454), [#455](https://github.com/ruddvz/Arq/issues/455)

Prior slices: S17

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E14-O01
Implement level create/rename/elevation/duplicate/delete using canonical operations.

**Acceptance:** Dependent elements are moved, copied or refused explicitly; no implicit vertical shift or cross-level deletion.

## E14-O02
Provide compact level switching, visibility and isolation in Plan and 3D.

**Acceptance:** View context and selection remain coherent when active elements are hidden or a level is deleted.

## E14-O03
Separate reusable types from instance overrides for walls/openings and material properties.

**Acceptance:** Editing a type shows affected instances and uses one transaction/undo group with correct derived updates.

## E14-O04
Exercise multi-level project switching, duplicate names, negative elevations and imported level IDs.

**Acceptance:** Stable IDs survive save/publish/reopen; label text is never used as semantic identity.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E15 · Image and PDF underlays
Stage: P1 · Accountable role: interoperability · State: proposed; gate not evaluated

Dependencies: E08, E09, E10

Existing issues: [#375](https://github.com/ruddvz/Arq/issues/375), [#376](https://github.com/ruddvz/Arq/issues/376)

Prior slices: S19

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E15-O01
Implement image ingress, scale calibration, placement, rotate, opacity, lock and tracing with resource provenance.

**Acceptance:** Two-point known-distance calibration survives save/reopen and does not alter canonical project units.

## E15-O02
Bound image dimensions/decoded memory, orientation metadata and unsupported encodings.

**Acceptance:** Corrupt/oversized/cancelled imports preserve the current model and report the failing resource.

## E15-O03
Add PDF underlay only after the image path is proven: page selection, declared raster/vector treatment and scale.

**Acceptance:** Multi-page, rotated, cropped and unusual page-size fixtures preserve measured distance within the approved tolerance.

## E15-O04
Track source replacement, resource cleanup, missing source and export participation.

**Acceptance:** Replacing a reference is explicit and reversible; removing an underlay cannot remove unrelated content-addressed resources.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E16 · Associative dimensions and precision annotation
Stage: P1 + UX-3 · Accountable role: geometry-bim · State: proposed; gate not evaluated

Dependencies: E03, E11, E14

Existing issues: [#385](https://github.com/ruddvz/Arq/issues/385), [#445](https://github.com/ruddvz/Arq/issues/445), [#465](https://github.com/ruddvz/Arq/issues/465)

Prior slices: S18

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E16-O01
Implement linear dimension placement and edits using stable semantic subreferences.

**Acceptance:** Dimension endpoints track supported geometry edits and become visibly broken when a reference no longer exists.

## E16-O02
Separate displayed precision, rounded labels, actual measurements and user overrides.

**Acceptance:** Metric/imperial formatting and locale separators never round canonical geometry or masquerade as measured values.

## E16-O03
Handle aligned/horizontal/vertical dimensions, text placement and crowded chains within the declared subset.

**Acceptance:** Small scale, zoom, long labels and overlapping annotations remain legible in Plan and PDF.

## E16-O04
Validate wall split/delete/rehost, copy, undo/redo, level switch and publication cases.

**Acceptance:** A dimension never silently points to another element, and independent reopened output reproduces the intended measurement.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E17 · Notes, labels and text editing
Stage: P1 + UX-3 · Accountable role: editor-interaction · State: proposed; gate not evaluated

Dependencies: E04, E06, E10

Existing issues: [#387](https://github.com/ruddvz/Arq/issues/387), [#447](https://github.com/ruddvz/Arq/issues/447)

Prior slices: S18

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E17-O01
Deliver durable text-note placement, in-place editing, selection and inspector properties.

**Acceptance:** Notes are canonical content with typed inverses, not demo journal notes or DOM-only state.

## E17-O02
Support multiline, Unicode, IME, copy/paste, wrapping, style and text extent calculations.

**Acceptance:** Editing text never triggers drawing shortcuts or loses composed input; unsafe markup is treated as text.

## E17-O03
Make room labels and annotations collision-aware and selectable with semantic alternatives.

**Acceptance:** Label movement does not alter room geometry; screen readers can inspect the text and associated entity.

## E17-O04
Verify font embedding/fallback, print text bounds and archive round trips.

**Acceptance:** Plan, sheet, vector PDF and reopened project retain content and declared typography without silent clipping.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E18 · Coordinated Plan and orthographic 3D
Stage: P1 + UX-4 · Accountable role: rendering-performance · State: proposed; gate not evaluated

Dependencies: E05, E11, E12, E13, E14

Existing issues: [#389](https://github.com/ruddvz/Arq/issues/389), [#468](https://github.com/ruddvz/Arq/issues/468), [#470](https://github.com/ruddvz/Arq/issues/470), [#457](https://github.com/ruddvz/Arq/issues/457), [#458](https://github.com/ruddvz/Arq/issues/458), [#488](https://github.com/ruddvz/Arq/issues/488)

Prior slices: S20

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E18-O01
Productionise Plan projection, lineweights, selection, snap glyphs, clipping and visible-level filtering.

**Acceptance:** Canonical edits invalidate the correct regions and preserve architectural scale and intended visual hierarchy.

## E18-O02
Productionise derived orthographic 3D, wall/opening meshes, materials, orbit, fit/reset and shared picking.

**Acceptance:** Plan/3D/tree select the same IDs; no stale meshes, invisible picks or camera loss after supported updates.

## E18-O03
Restrict direct 3D edits to explicit semantic operations and hand off unsupported edits clearly.

**Acceptance:** The 3D viewer cannot mutate mesh-only state and imply durable architectural change.

## E18-O04
Handle WebGL context loss, init failure, weak GPU and renderer fallback.

**Acceptance:** Users can keep or export their project, errors are actionable, and rendering degradation never changes canonical geometry.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E19 · Model browser and inspector
Stage: P1 + UX-4 · Accountable role: editor-interaction · State: proposed; gate not evaluated

Dependencies: E04, E05, E14, E18

Existing issues: [#391](https://github.com/ruddvz/Arq/issues/391), [#449](https://github.com/ruddvz/Arq/issues/449), [#456](https://github.com/ruddvz/Arq/issues/456)

Prior slices: S17

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E19-O01
Deliver hierarchy/search/filtering for real levels, objects, types and views, including empty and inaccessible results.

**Acceptance:** Large-tree virtualisation preserves keyboard navigation, stable selection and meaningful announcements.

## E19-O02
Expose identity, geometry, type/instance, relationships, warnings and history through the owned semantic model.

**Acceptance:** No property is invented from display labels; read-only and unsupported properties state why.

## E19-O03
Unify exact numeric inputs, mixed-value states, validation, multi-edit and transaction boundaries.

**Acceptance:** A multi-selection edit succeeds atomically or reports per-policy refusal with no partial committed state.

## E19-O04
Test selection/focus across tree, inspector, Plan/3D, hidden levels and deleted entities.

**Acceptance:** Inspector data matches current revision and focus remains usable after rerender, filter and navigation.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E20 · One live plan sheet and verified vector PDF
Stage: P1 + UX-6 · Accountable role: interoperability · State: proposed; gate not evaluated

Dependencies: E15, E16, E17, E18, E19

Existing issues: [#393](https://github.com/ruddvz/Arq/issues/393), [#395](https://github.com/ruddvz/Arq/issues/395), [#472](https://github.com/ruddvz/Arq/issues/472), [#473](https://github.com/ruddvz/Arq/issues/473), [#474](https://github.com/ruddvz/Arq/issues/474), [#475](https://github.com/ruddvz/Arq/issues/475)

Prior slices: S21, S22

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E20-O01
Create a durable plan-sheet model with page size/orientation, live viewport, scale, placement and supported title/metadata.

**Acceptance:** Sheet edits persist and reference current semantic content rather than a stale screenshot.

## E20-O02
Implement viewport selection, direct arrangement, numeric scale and print preview using shared commands.

**Acceptance:** Paper dimensions, model units and viewport scale have separate fields and cannot silently multiply each other.

## E20-O03
Generate vector PDF with embedded fonts, stable lineweights, labels, clipping and declared limitations.

**Acceptance:** Independently inspect physical page dimensions and known distances in at least two readers; compare PDF semantics with the current sheet.

## E20-O04
Provide export preflight, progress, cancel, failure and delivery feedback.

**Acceptance:** Unsupported features are reported before export; cancellation or memory exhaustion leaves the project untouched and never reports a delivered file.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E21 · Accessible architectural workflow
Stage: P1 + UX-8 · Accountable role: accessibility · State: proposed; gate not evaluated

Dependencies: E10, E19, E20

Existing issues: [#400](https://github.com/ruddvz/Arq/issues/400), [#484](https://github.com/ruddvz/Arq/issues/484), [#486](https://github.com/ruddvz/Arq/issues/486), [#491](https://github.com/ruddvz/Arq/issues/491)

Prior slices: S12

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E21-O01
Provide semantic alternatives to canvas selection, inspection, property edits and commands.

**Acceptance:** Keyboard/screen-reader users can open, select, edit, undo, export and recover without pointer-only dependencies.

## E21-O02
Close focus order, focus visibility, modal restoration, status announcement and shortcut conflicts.

**Acceptance:** No keyboard traps or obscured essential focus; errors identify the field and recovery action without excessive live-region chatter.

## E21-O03
Verify contrast, non-colour states, target sizes, reduced motion and reflow/zoom across active surfaces.

**Acceptance:** Applicable WCAG 2.2 AA criteria have criterion-level evidence and exceptions are explicit; screenshots alone cannot pass the gate.

## E21-O04
Run VoiceOver/Safari and NVDA/supported Windows browser sessions with users where feasible.

**Acceptance:** Assistive-technology version, tasks, barriers and fixes are recorded; the protected workflow passes after final integration.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E22 · Browser, tablet, phone and input matrix
Stage: P1 + UX-1/8 · Accountable role: accessibility · State: proposed; gate not evaluated

Dependencies: E10, E20

Existing issues: [#219](https://github.com/ruddvz/Arq/issues/219), [#358](https://github.com/ruddvz/Arq/issues/358), [#359](https://github.com/ruddvz/Arq/issues/359), [#360](https://github.com/ruddvz/Arq/issues/360), [#414](https://github.com/ruddvz/Arq/issues/414), [#416](https://github.com/ruddvz/Arq/issues/416), [#485](https://github.com/ruddvz/Arq/issues/485), [#487](https://github.com/ruddvz/Arq/issues/487)

Prior slices: S11, S23

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E22-O01
Reconcile #362 vendor capability matrix and #363 three-engine smoke evidence with actual supported OS/device policy.

**Acceptance:** Chromium, Firefox and WebKit tests name exact versions; engine simulation never stands for real Safari or iPad evidence.

## E22-O02
Define desktop authoring, iPad authoring and phone review/light-edit scope explicitly.

**Acceptance:** Each supported command has a tested input route; unavailable device features are explained rather than compressed into unusable controls.

## E22-O03
Test pen/touch/mouse/trackpad transitions, palm interference, pointer cancel/capture, orientation, virtual keyboard and safe areas.

**Acceptance:** No accidental geometry commits, blocked dialogs or hidden export/recovery controls on supported hardware.

## E22-O04
Capture responsive/theme/critical-state visual matrix and validate 200% zoom and narrow widths.

**Acceptance:** Real devices satisfy published claims; unsupported Firefox/OS or Pencil combinations remain excluded until their own gate passes.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E23 · Performance, scale and lifecycle endurance
Stage: P1 + UX-8 · Accountable role: rendering-performance · State: proposed; gate not evaluated

Dependencies: E18, E20

Existing issues: [#402](https://github.com/ruddvz/Arq/issues/402), [#489](https://github.com/ruddvz/Arq/issues/489), [#490](https://github.com/ruddvz/Arq/issues/490), [#399](https://github.com/ruddvz/Arq/issues/399)

Prior slices: S24

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E23-O01
Measure the protected 1,000-object house on representative physical hardware, cold/warm open and realistic storage.

**Acceptance:** Reports include workload, device, browser, percentiles, peak memory and variance; inherited CI medians are not physical-device certification.

## E23-O02
Enforce interactive/open/select/hover/commit/undo/PDF and bundle budgets from the existing performance contract.

**Acceptance:** p95/p99 and memory ceilings are calibrated and accepted before beta; no hot path exceeds its approved budget without a release decision.

## E23-O03
Improve Worker backpressure, stale-result cancellation, incremental derivation and resource lifetime from profiling.

**Acceptance:** Rapid edits and slow workers do not grow unbounded queues or apply stale geometry.

## E23-O04
Run repeated open/close, A→B→A, sheet/3D switching and long-session soak with leak detection.

**Acceptance:** Worker counts and retained memory plateau after cleanup; performance degrades explicitly before data integrity is at risk.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E24 · Diagnostics, support and incident readiness
Stage: P1 · Accountable role: incident-commander · State: proposed; gate not evaluated

Dependencies: E07, E09

Existing issues: [#448](https://github.com/ruddvz/Arq/issues/448), [#218](https://github.com/ruddvz/Arq/issues/218)

Prior slices: S26

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E24-O01
Wire local diagnostic IDs, operation/revision context and error taxonomy through storage, import, rendering and UI.

**Acceptance:** A failure can be traced across layers without uploading raw project content by default.

## E24-O02
Build redacted opt-in support bundles, preview/export and privacy controls.

**Acceptance:** Secrets, paths, account identifiers and project contents are excluded or explicitly consented; tests exercise realistic leakage cases.

## E24-O03
Prepare support knowledge base, recovery scripts, escalation roles and incident severity response.

**Acceptance:** A support rehearsal diagnoses a failed save, helps export a verified copy and records a reproducible issue with the correct build.

## E24-O04
Define service hours, crash reporting consent, retention and post-incident review.

**Acceptance:** Every critical incident has containment, customer communication, regression fixture and an accountable closure owner.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E25 · Protected Core integration and defect closure
Stage: P1 gate · Accountable role: qa-release · State: proposed; gate not evaluated

Dependencies: E03, E04, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17, E18, E19, E20, E21, E22, E23, E24

Existing issues: [#406](https://github.com/ruddvz/Arq/issues/406), [#476](https://github.com/ruddvz/Arq/issues/476), [#397](https://github.com/ruddvz/Arq/issues/397), [#453](https://github.com/ruddvz/Arq/issues/453), [#492](https://github.com/ruddvz/Arq/issues/492), [#369](https://github.com/ruddvz/Arq/issues/369)

Prior slices: S23, S29

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E25-O01
Run New → underlay → walls/openings/rooms → dimensions/notes → levels/Plan/3D → sheet/PDF → publish → close → fresh reopen.

**Acceptance:** Exact candidate build completes the supported journey without manual state repair and with semantic/visual/document agreement.

## E25-O02
Turn every relevant anticipated risk, edge case and QA catalogue row into implemented test evidence, justified exclusion or an open owned defect.

**Acceptance:** All 168 risks, 84 edge cases and 309 QA rows are accounted for; risk records are never relabelled confirmed bugs without reproduction.

## E25-O03
Inject failures at transaction, Worker, file, parser, render, update and recovery boundaries.

**Acceptance:** No known silent committed-data loss, semantic corruption, wrong-project write, false durability or unrecoverable migration remains.

## E25-O04
Run regression triage and CTO integration review after fixes.

**Acceptance:** Zero open P0/P1 in the release scope; flaky critical tests fail the gate rather than being quarantined out of sight; final evidence fingerprints the candidate tree and artefacts.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E26 · Name, legal, commercial and policy readiness
Stage: P1A + GA · Accountable role: product-architecture · State: proposed; gate not evaluated

Dependencies: E01, E02

Existing issues: [#40](https://github.com/ruddvz/Arq/issues/40), [#216](https://github.com/ruddvz/Arq/issues/216), [#217](https://github.com/ruddvz/Arq/issues/217), [#218](https://github.com/ruddvz/Arq/issues/218)

Prior slices: S32

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E26-O01
Complete working-name/domain/store clearance and identify the legal owner; reconcile public repository visibility with proprietary/confidential wording.

**Acceptance:** Recorded decisions and reviewed licence/terms match actual distribution; automated planning makes no licence or visibility change.

## E26-O02
Review privacy, terms, acceptable use, AI data use, contributor and third-party distribution obligations.

**Acceptance:** Required expert decisions are resolved for each launch market/channel and policy statements match observed data flows.

## E26-O03
Validate pricing, free/paid boundaries, entitlements, cancellation/refund rules and service economics.

**Acceptance:** Customer files remain accessible independent of paid service state; cost assumptions and paid feature promises are explicit.

## E26-O04
Assign support, retention, backup, abuse and incident owners with budget and operating capacity.

**Acceptance:** Alpha has necessary consent/support controls; GA has complete applicable policy and commercial decisions, without claiming legal compliance from this plan.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E27 · Public website, onboarding and product education
Stage: P1 + public W0-W6 · Accountable role: ui-visual · State: proposed; gate not evaluated

Dependencies: E02, E10

Existing issues: [#494](https://github.com/ruddvz/Arq/issues/494), [#205](https://github.com/ruddvz/Arq/issues/205), [#404](https://github.com/ruddvz/Arq/issues/404), [#491](https://github.com/ruddvz/Arq/issues/491)

Prior slices: S27, S28

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E27-O01
Reconcile draft #495 with both branches and existing local marketing changes; validate its PUB-001 slice before page-family rollout.

**Acceptance:** Screenshots, responsive/zoom, route, build and governed-claim checks pass at the intended marketing revision.

## E27-O02
Complete the 17 public routes and relevant auth/app page states with truthful stage-specific claims.

**Acceptance:** Every CTA leads to an available try/download/help path; decorative examples cannot be mistaken for saved, synchronised or generated production results.

## E27-O03
Create guided first project, sample files, keyboard/tool help, recovery education and migration/release notes.

**Acceptance:** Instructions are verified against the shipped UI and users can independently reopen a downloaded project.

## E27-O04
Validate domains/TLS, redirects, sitemap/robots, metadata, social cards, accessibility, contact/status paths and analytics consent.

**Acceptance:** Broken links, stale build claims and misleading availability text block the relevant launch; SEO never advertises unsupported features.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E28 · Distribution contract, web install and update pipeline
Stage: P1 + GA · Accountable role: delivery-reliability · State: proposed; gate not evaluated

Dependencies: E02, E07, E09, E26

Existing issues: [#453](https://github.com/ruddvz/Arq/issues/453), [#332](https://github.com/ruddvz/Arq/issues/332), [#219](https://github.com/ruddvz/Arq/issues/219)

Prior slices: S29, S30, S31

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E28-O01
Decide the initial supported download/install channels: browser, installable web app, native iPad and/or desktop packages.

**Acceptance:** The release manifest distinguishes app installation from .arq project download; required native channels have explicit launch dependencies E44/E45.

## E28-O02
Build reproducible web artefacts and evaluate installable PWA behaviour, manifest/icons/offline cache and file associations.

**Acceptance:** If PWA is selected, clean install, offline reopen, update and uninstall pass on each claimed platform; if not, marketing says browser access plainly.

## E28-O03
Bind deploys, Worker/WASM assets, cache headers, source maps and provenance to one candidate.

**Acceptance:** Mixed old/new assets and update-during-edit cannot corrupt work; failed update preserves the compatible previous app and project copy.

## E28-O04
Activate Engineering OS required gates separately from branch migration; verify environment reviewers, preview access, deployment quotas and rollback.

**Acceptance:** A deliberately bad candidate is rejected, an approved candidate deploys, routes verify the expected SHA and rollback respects schema compatibility.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E29 · Controlled architect alpha
Stage: P1A · Accountable role: qa-release · State: proposed; gate not evaluated

Dependencies: E25, E26

Existing issues: [#408](https://github.com/ruddvz/Arq/issues/408), [#211](https://github.com/ruddvz/Arq/issues/211), [#36](https://github.com/ruddvz/Arq/issues/36), [#37](https://github.com/ruddvz/Arq/issues/37), [#38](https://github.com/ruddvz/Arq/issues/38)

Prior slices: S33

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E29-O01
Recruit the approved architect cohort and use real task-driven projects under the alpha support envelope.

**Acceptance:** Existing research targets are completed or explicitly reconciled; participants know storage, limitations and recovery before using valuable work.

## E29-O02
Observe independent authoring, edits, paper output, portable copy and interruption recovery.

**Acceptance:** Task success, time, assistance, trust comprehension and severity are recorded; polished demos cannot substitute for sessions.

## E29-O03
Fix P0/P1 and repeated usability failures through bounded existing owner issues.

**Acceptance:** Reproduction, regression fixture and retest link each finding to the integrated candidate; alpha does not expand scope to avoid finishing Core.

## E29-O04
Review findings and accept or reject the Core baseline.

**Acceptance:** Owner acceptance, CTO reconciliation and rerun protected workflow precede P2 expansion; missing human evidence remains a visible blocker.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E30 · Public beta and release-candidate campaign
Stage: GA runway · Accountable role: qa-release · State: proposed; gate not evaluated

Dependencies: E29, E27, E28

Existing issues: [#453](https://github.com/ruddvz/Arq/issues/453), [#492](https://github.com/ruddvz/Arq/issues/492), [#369](https://github.com/ruddvz/Arq/issues/369)

Prior slices: S33

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E30-O01
Expand gradually to the declared OS/browser/project-size envelope with clear beta labelling and support capacity.

**Acceptance:** Cohort admission is reversible, real projects can export out and all feedback has triage ownership.

## E30-O02
Run longitudinal crash, recovery, export and upgrade tests plus accessibility/usability retests.

**Acceptance:** Approved reliability denominators and confidence windows are met; low volume is reported rather than interpreted as perfect reliability.

## E30-O03
Freeze a candidate and audit all user-visible commands, documentation claims, legal text and known issues.

**Acceptance:** No required feature is a placeholder; every enabled command has happy/error/recovery evidence on the frozen build.

## E30-O04
Rehearse release, service outage, credential rotation and data-compatible rollback.

**Acceptance:** Incident owners can execute the runbook and retain users' latest compatible work; critical failures reset the candidate gate.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E31 · Stable Core launch and public availability
Stage: GA Core · Accountable role: delivery-reliability · State: proposed; gate not evaluated

Dependencies: E30

Existing issues: [#453](https://github.com/ruddvz/Arq/issues/453), [#370](https://github.com/ruddvz/Arq/issues/370), [#369](https://github.com/ruddvz/Arq/issues/369)

Prior slices: S31, S33

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E31-O01
Publish versioned stable artefacts, release notes, support matrix and checksums/provenance for the approved channel.

**Acceptance:** Public try/download/install links resolve to the verified version from a clean non-developer environment.

## E31-O02
Verify install/first-run, sample/new/open, offline use, export, update and recovery from the public distribution path.

**Acceptance:** Website SHA, artefact hashes and actual runtime version agree; no developer-only dependency is required.

## E31-O03
Roll out in monitored cohorts with explicit stop/rollback triggers.

**Acceptance:** Crash/error/support metrics stay within the accepted budget; a P0/P1 or confirmed data-integrity incident stops rollout immediately.

## E31-O04
Record the Core GA decision and ongoing ownership.

**Acceptance:** Core availability is distinct from completion of the mature P0-P10 vision; later features remain visibly staged until their own gates pass.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E32 · Stable operations and reliability growth
Stage: Continuous · Accountable role: incident-commander · State: proposed; gate not evaluated

Dependencies: E31

Existing issues: [#448](https://github.com/ruddvz/Arq/issues/448), [#453](https://github.com/ruddvz/Arq/issues/453), [#369](https://github.com/ruddvz/Arq/issues/369), [#467](https://github.com/ruddvz/Arq/issues/467)

Prior slices: S44

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E32-O01
Operate triage, patch releases, compatibility checks and support service with user-impact priorities.

**Acceptance:** Each critical defect has a reproduction, owner, response clock and verified customer-facing resolution.

## E32-O02
Review reliability/error budgets, regressions, support causes and adoption cohorts at agreed intervals.

**Acceptance:** New feature rollout pauses when critical stability targets regress; the denominator and observation period are visible.

## E32-O03
Maintain dependency/security updates, backup restore drills and platform end-of-support policy.

**Acceptance:** Supported releases receive fixes; users get compatible migration/export routes before a channel is retired.

## E32-O04
Refresh roadmap from measured architect outcomes and postmortems.

**Acceptance:** New work maps to evidence and existing scope owners; roadmap maintenance never reclassifies an unverified capability as shipped.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E33 · Cloud identity, tenancy and commercial services
Stage: P2 enabling · Accountable role: security · State: proposed; gate not evaluated

Dependencies: E29, E09, E26

Existing issues: [#410](https://github.com/ruddvz/Arq/issues/410), [#417](https://github.com/ruddvz/Arq/issues/417), [#450](https://github.com/ruddvz/Arq/issues/450), [#217](https://github.com/ruddvz/Arq/issues/217)

Prior slices: S34, S38

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E33-O01
Implement the API beyond its current stub with authentication/session recovery, account settings and tenant/project permissions.

**Acceptance:** Cross-tenant object access, revocation, expired tokens and anonymous routes fail closed; offline local authoring remains useful.

## E33-O02
Build object storage, semantic snapshot upload, jobs, rate limits, idempotency and regional/retention controls.

**Acceptance:** Resumable transfer, retry, deletion and restore tests preserve identity and prevent duplicates or leaked project data.

## E33-O03
Add hosted billing/entitlements only if paid cloud is selected.

**Acceptance:** Signed idempotent webhooks, cancellation, grace periods, refunds and quota boundaries cannot trap local project files.

## E33-O04
Qualify backups, disaster recovery, load, abuse/cost controls and on-call ownership.

**Acceptance:** Restore drills meet approved RPO/RTO; capacity and service-cost measurements precede promises or public SLAs.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E34 · Universal fidelity and bounded exchange
Stage: P2 · Accountable role: interoperability · State: proposed; gate not evaluated

Dependencies: E29, E09, E03

Existing issues: [#415](https://github.com/ruddvz/Arq/issues/415), [#411](https://github.com/ruddvz/Arq/issues/411), [#413](https://github.com/ruddvz/Arq/issues/413), [#466](https://github.com/ruddvz/Arq/issues/466), [#471](https://github.com/ruddvz/Arq/issues/471)

Prior slices: S37

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E34-O01
Use one staged import/export fidelity report for preserved, approximated, flattened, omitted and opaque-preserved content.

**Acceptance:** Source file, version, unit/origin transform and losses are inspectable before canonical commit.

## E34-O02
Ship the declared DXF linework import/export subset with layer/style, units and coordinate reconciliation.

**Acceptance:** Representative external corpus files compare with independent readers; unsupported entities never disappear without a report.

## E34-O03
Wire IFC viewing, property inspection and bounded coordination over existing adapters.

**Acceptance:** Large/corrupt/mixed-unit models respect resource limits; IFC viewing is not marketed as full IFC authoring.

## E34-O04
Test cancel/retry/memory pressure and all export deliveries from current revision.

**Acceptance:** Failed import cannot replace the open model; failed download cannot report success; reversible staging and provenance survive supported workflows.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E35 · Revision-bound sharing and review
Stage: P2 · Accountable role: security · State: proposed; gate not evaluated

Dependencies: E33, E34

Existing issues: [#417](https://github.com/ruddvz/Arq/issues/417), [#410](https://github.com/ruddvz/Arq/issues/410)

Prior slices: S35, S36

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E35-O01
Implement review snapshots/share links with scope, expiry, revocation and viewer permissions.

**Acceptance:** Server-side enforcement prevents stale links, previews and cache paths from exposing revoked projects.

## E35-O02
Anchor comments/issues to explicit project revision and stable semantic references.

**Acceptance:** Deleted/changed objects and inaccessible snapshots have honest stale/missing states rather than silently moving anchors.

## E35-O03
Provide semantic revision comparison and review resolution with accessible navigation.

**Acceptance:** Differences represent supported model/document changes and distinguish missing data from unchanged data.

## E35-O04
Prove offline reconnect, duplicated events, account removal and restore.

**Acceptance:** Review cannot silently become concurrent authoring; local copies and cloud shared snapshots have clear ownership and durability states.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E36 · Read-only Agent, proposals and Review Centre
Stage: P3 · Accountable role: ai-arqscript · State: proposed; gate not evaluated

Dependencies: E35, E05

Existing issues: [#419](https://github.com/ruddvz/Arq/issues/419), [#421](https://github.com/ruddvz/Arq/issues/421), [#422](https://github.com/ruddvz/Arq/issues/422), [#477](https://github.com/ruddvz/Arq/issues/477), [#478](https://github.com/ruddvz/Arq/issues/478), [#479](https://github.com/ruddvz/Arq/issues/479), [#481](https://github.com/ruddvz/Arq/issues/481), [#482](https://github.com/ruddvz/Arq/issues/482), [#483](https://github.com/ruddvz/Arq/issues/483)

Prior slices: S39

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E36-O01
Wire the existing governed MCP host to explicit project/revision context, scoped grants, expiry and revocation.

**Acceptance:** Read-only explain/query is product-reachable without granting hidden file paths, database queries or mutation tools.

## E36-O02
Build proposal objects with intent, assumptions, affected IDs, validation, source provenance, cost and predicted document impact.

**Acceptance:** Ambiguous requests ask for bounded inputs or produce a clearly marked proposal; uncertainty is not invented geometry.

## E36-O03
Integrate Review Centre diff and Plan/3D/document highlights with usable keyboard and screen-reader navigation.

**Acceptance:** The user can inspect what will change before approval and identify the exact revision being reviewed.

## E36-O04
Handle streaming, cancel, timeout, interrupted provider runs and grant loss.

**Acceptance:** Failures preserve the model, partial output cannot look committed, and private project data stays inside the approved data policy.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E37 · Approved Agent actions, Skills and adversarial evaluation
Stage: P3 gate · Accountable role: ai-arqscript · State: proposed; gate not evaluated

Dependencies: E36

Existing issues: [#424](https://github.com/ruddvz/Arq/issues/424), [#426](https://github.com/ruddvz/Arq/issues/426), [#428](https://github.com/ruddvz/Arq/issues/428), [#480](https://github.com/ruddvz/Arq/issues/480)

Prior slices: S39, S40

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E37-O01
Apply approved proposals through the canonical validation/operation/persistence path with revision checks and grouped undo.

**Acceptance:** Stale, unauthorised or partially invalid plans fail closed; applied changes publish/reopen and undo as a coherent operation group.

## E37-O02
Version reusable Skills with capability requirements, input schema, review level and provenance.

**Acceptance:** Revoked/incompatible Skills are refused; execution remains auditable and no arbitrary script bypasses typed operations.

## E37-O03
Build task, regression and red-team evaluations for ambiguous intent, prompt injection, destructive scope and cost exhaustion.

**Acceptance:** Acceptance measures task success, invalid-action refusal, semantic fidelity and reversibility, not just fluent responses.

## E37-O04
Run real supported client sessions and integrate support/kill switches.

**Acceptance:** An external AI client can complete an approved bounded architectural change under the same grant, review and recovery contract as the native UI.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E38 · ARQ Connect and first external host
Stage: P4 · Accountable role: ai-arqscript · State: proposed; gate not evaluated

Dependencies: E37

Existing issues: [#430](https://github.com/ruddvz/Arq/issues/430)

Prior slices: New lifecycle expansion.

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E38-O01
Define Host Adapter SDK with document identity/revision, context, capabilities, typed tools, transactions, undo and result verification.

**Acceptance:** The host file remains authoritative; generic screen automation cannot claim semantic CAD control.

## E38-O02
Run a host bake-off across requested candidate ecosystems using current APIs, licences and user workflows.

**Acceptance:** Connector 0 is selected from evidence and distribution/support feasibility; no Revit/Rhino/SketchUp/AutoCAD/Blender/Archicad parity promise by assumption.

## E38-O03
Implement one useful read and reviewed reversible write workflow with host-native undo.

**Acceptance:** Wrong-document, stale-document, permission denial, crash and mid-command document switch fail safely.

## E38-O04
Package installer/update/uninstall, host-version compatibility, diagnostics and connector conformance tests.

**Acceptance:** A clean supported machine can install, perform the protected action, roll back and remove the connector without damaging host documents.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E39 · Advanced documentation and controlled professional exchange
Stage: R3 / P10 subset · Accountable role: interoperability · State: proposed; gate not evaluated

Dependencies: E37, E20, E34

Existing issues: [#442](https://github.com/ruddvz/Arq/issues/442)

Prior slices: S42

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E39-O01
Add door/window/room schedules with stable properties and live revision binding.

**Acceptance:** Rows reconcile with canonical entities and units; edits, deletes and type changes invalidate schedules predictably.

## E39-O02
Qualify bounded sections/elevations with cuts, visibility and annotation rules.

**Acceptance:** Independent reference drawings verify geometry and dimension consistency; unsupported constructions are reported.

## E39-O03
Implement a controlled IFC export subset, classification mappings and loss reports.

**Acceptance:** External-tool validation and representative round trips show the supported boundary without promising full BIM authoring fidelity.

## E39-O04
Expand sheet sets, revision tables, document issue/publish and printing only through accepted scope decisions.

**Acceptance:** Issued output has immutable revision provenance and reissued documents cannot silently reuse stale render caches.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E40 · Visualise and Present
Stage: P5 · Accountable role: rendering-performance · State: proposed; gate not evaluated

Dependencies: E37, E18

Existing issues: [#432](https://github.com/ruddvz/Arq/issues/432)

Prior slices: New lifecycle expansion.

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E40-O01
Create saved camera/view and output provenance for materials, lighting, environment and presentation.

**Acceptance:** Each result records project revision, camera and settings and becomes stale when the relevant model changes.

## E40-O02
Separate strict-geometry visualisation from creative imagery in UI and data.

**Acceptance:** Geometry-preserving modes pass measured fidelity tests; creative results never become authoritative geometry.

## E40-O03
Implement provider/renderer cancellation, privacy, budget limits and failure recovery.

**Acceptance:** A failed or expensive run cannot mutate the project or leave unexplained charges/cost consumption.

## E40-O04
Deliver presentation boards/walkthroughs with export and accessibility requirements.

**Acceptance:** Outputs are supportable and reproducible enough to diagnose; user studies demonstrate value beyond attractive demo images.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E41 · Firm standards, libraries and precedent knowledge
Stage: P6 · Accountable role: product-architecture · State: proposed; gate not evaluated

Dependencies: E35, E37

Existing issues: [#434](https://github.com/ruddvz/Arq/issues/434)

Prior slices: New lifecycle expansion.

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E41-O01
Create versioned templates, types/material libraries and firm standards with explicit apply/update operations.

**Acceptance:** Library changes preview impact and preserve local overrides under a documented policy.

## E41-O02
Add explainable rule graphs with source/version, applicability and evidence.

**Acceptance:** Pass/warn/fail is traceable and does not imply professional approval or universal code compliance.

## E41-O03
Build permission-aware precedent search and project knowledge with source revision citations.

**Acceptance:** Cross-firm/project information cannot leak through embeddings, caches, search snippets or Agent context.

## E41-O04
Govern firm Skills with publish/revoke/version lifecycle and offline behaviour.

**Acceptance:** Revocation and incompatibility are explicit; users retain local project ownership when firm services are unavailable.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E42 · Site, programme, analysis and generative alternatives
Stage: P7 · Accountable role: geometry-bim · State: proposed; gate not evaluated

Dependencies: E41, E03

Existing issues: [#436](https://github.com/ruddvz/Arq/issues/436)

Prior slices: S40, S41

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E42-O01
Represent site/lot, orientation, levels, programme and constraints as typed sourced inputs.

**Acceptance:** Coordinate systems, units, provenance, applicability and missing inputs are visible before any analysis or generation.

## E42-O02
Implement bounded layout/furnishing alternatives with deterministic validation and editable semantic output.

**Acceptance:** Alternatives state assumptions, score constraint satisfaction and never bypass the canonical operation/review path.

## E42-O03
Qualify area/quantity/cost and environmental metrics with reference datasets, location/date/rate assumptions and uncertainty.

**Acceptance:** Quantities reconcile with the model; heuristic cost or simulation output is not presented as a certified estimate.

## E42-O04
Add jurisdiction/version-specific checks only with qualified domain review.

**Acceptance:** Rules record edition, building/use category, exclusions and overrides; English room names or hard-coded thresholds cannot establish compliance.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E43 · Concurrent collaboration and revision intelligence
Stage: P8 · Accountable role: arqfs-recovery · State: proposed; gate not evaluated

Dependencies: E35, E37

Existing issues: [#438](https://github.com/ruddvz/Arq/issues/438)

Prior slices: S35

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E43-O01
Define concurrent semantic edit model, authority and conflict classes before enabling shared mutation.

**Acceptance:** Transport uses versioned operations/snapshots, never raw SQLite pages, and preserves local recovery.

## E43-O02
Implement offline queues, ordering, deduplication, retry, safe rebase and permission revalidation.

**Acceptance:** Partitions and out-of-order events converge for the declared subset or surface explicit conflicts without lost intent.

## E43-O03
Provide presence, ownership/conflict resolution, design options and revision history where validated.

**Acceptance:** Presence is not mistaken for durability; conflict UI shows alternatives and consequences and supports reversible resolution.

## E43-O04
Run multi-client chaos/load/restore and mixed-version compatibility campaigns.

**Acceptance:** Revoked writers, stale clients, server loss and concurrent host deletion never create silent corruption or cross-tenant exposure.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E44 · Native iPad, Files and spatial capture
Stage: P9 · Accountable role: arqfs-recovery · State: proposed; gate not evaluated

Dependencies: E29, E22, E28

Existing issues: [#440](https://github.com/ruddvz/Arq/issues/440), [#359](https://github.com/ruddvz/Arq/issues/359)

Prior slices: S43

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E44-O01
Select native architecture with shared-core/FFI and document identity contracts based on measured platform need.

**Acceptance:** No native-only storage authority makes supported web/native .arq exchange lossy or unreadable.

## E44-O02
Implement Files/open-in/share/export, background/foreground, offline editing and interrupted-write recovery.

**Acceptance:** Real hardware retains portable data under app termination, storage pressure, picker cancellation and OS update.

## E44-O03
Add supported Pencil hover/double tap/squeeze/haptic behaviours and keyboard/trackpad/VoiceOver parity.

**Acceptance:** Exact hardware/OS combinations pass physical tests and unsupported combinations degrade gracefully.

## E44-O04
Prototype RoomPlan/LiDAR capture with calibration/accuracy and correction UX, then qualify App Store/TestFlight distribution.

**Acceptance:** Capture states measurement limitations; install/update/uninstall, privacy/permission disclosures and store review obligations are satisfied before public availability.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E45 · Desktop downloads and native update lifecycle
Stage: Distribution extension · Accountable role: delivery-reliability · State: proposed; gate not evaluated

Dependencies: E31, E28, E09

Existing issues: [#453](https://github.com/ruddvz/Arq/issues/453)

Prior slices: New lifecycle expansion.

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E45-O01
Decide whether macOS/Windows and optionally Linux native shells materially improve file/workflow reliability over the browser.

**Acceptance:** A documented ADR selects platform/toolkit/support versions; this is a proposed extension, not an existing desktop implementation claim.

## E45-O02
Build signed/notarised or platform-appropriate packages, file associations, single-instance document opening and native save dialogs.

**Acceptance:** Clean machines install and launch without developer tools; source files and shared-core invariants remain protected.

## E45-O03
Deliver authenticated update metadata, staged rollout, compatible downgrade/rollback and offline update failure handling.

**Acceptance:** Tampered/interrupted updates refuse safely and never migrate the only good project copy irreversibly.

## E45-O04
Test install/update/repair/uninstall, entitlements, antivirus/Gatekeeper behaviour, paths/Unicode and enterprise restrictions.

**Acceptance:** Public download links, checksums, support matrix and release notes match the tested binary; uninstall clearly distinguishes app removal from user data deletion.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E46 · Advanced architecture and specialist ecosystem
Stage: P10 · Accountable role: product-architecture · State: proposed; gate not evaluated

Dependencies: E38, E39, E40, E41, E42, E43

Existing issues: [#442](https://github.com/ruddvz/Arq/issues/442)

Prior slices: New lifecycle expansion.

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E46-O01
Prioritise curved walls, slabs, stairs/railings, roofs, families, renovation/design options and richer modelling from real unmet demand.

**Acceptance:** Each selected capability gets an ADR/semantic contract and a separate fixture/evidence campaign; speculative catalogue rows remain gated.

## E46-O02
Evaluate BCF, IDS/bSDD, glTF/GLB, STEP, DWG/RVT and structural/MEP interfaces according to actual use and licences.

**Acceptance:** Exact supported directions/subsets and losses are published; no blanket incumbent compatibility or professional safety claim.

## E46-O03
Create a versioned extension SDK with sandboxing, permissions, signing, compatibility discovery and safe-open quarantine.

**Acceptance:** At least one third-party-style extension works without privileged core access and a malicious/broken extension cannot compromise projects.

## E46-O04
Establish marketplace/moderation/licensing/support policies before external extension distribution.

**Acceptance:** Abuse, revocation, compromised packages, abandoned extensions and migration ownership have rehearsed procedures.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.


## E47 · Mature-product acceptance, evolution and retirement
Stage: P10 exit + lifecycle · Accountable role: qa-release · State: proposed; gate not evaluated

Dependencies: E32, E38, E39, E40, E41, E42, E43, E44, E45, E46

Existing issues: [#367](https://github.com/ruddvz/Arq/issues/367), [#442](https://github.com/ruddvz/Arq/issues/442), [#453](https://github.com/ruddvz/Arq/issues/453), [#369](https://github.com/ruddvz/Arq/issues/369)

Prior slices: S44

All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.

## E47-O01
Reconcile the accepted mature scope against every feature, issue, branch, risk, decision and distribution promise.

**Acceptance:** #367 closes only when required P10 outcomes pass or an explicit owner-approved successor records every deferred obligation.

## E47-O02
Run representative end-to-end journeys spanning manual authoring, documents, exchange, Agent, connectors, collaboration and native channels.

**Acceptance:** No enabled surface bypasses identity, validation, durability, accessibility, privacy or support contracts.

## E47-O03
Define long-term format compatibility, old-version readers/exporters, security support and upgrade communication.

**Acceptance:** Users can retain and open their own data through supported transitions; migration/rollback is demonstrated with historical fixtures.

## E47-O04
Plan feature/service retirement, account closure, connector removal and final data export.

**Acceptance:** Notice, retention/deletion, backup expiry and offline archive access follow approved policies; product shutdown does not strand user projects.

## Gate evidence and handoff
Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.



# Register location and coverage

The companion programme.json and registers directory contain every captured source record with proposed phase routes, source links and disposition. The HTML presents this register with search and filters. Source stage/applicability controls inclusion; allocated does not mean implemented.

# ARQ package reconciliation and release audit, 2026-08-04

## Finished result

A reviewable local implementation now contains the applicable Priority 0 truth,
website, claim-governance, security-lint, and Engineering OS corrections from
`ARQ_FINAL_REPOSITORY_AND_SITE_PACKAGE_2026-08-04(2).zip`.

The package was not copied over the repository. Its SHA256 manifest was verified,
its candidate patch was compared path by path with the current remote default
branch, and current architecture authority was checked before changes were
accepted.

Two additional current corrections were added. Proposed ADR-0028 defines the
missing persistence responsibility decision without pretending it is Accepted.
The active brand authority was also reconciled so public language uses ARQ while
code identifiers, packages, literal lowercase routes, and the `.arq` extension
retain lowercase `arq`.
The project-open lifecycle remains Blocked until an accountable owner accepts,
revises, or rejects that ADR.

No remote branch, pull request, merge, Pages deployment, licence change, or
protected approval was created.

## Repository identity and preflight

| Item                           | Observed state                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Repository                     | `ruddvz/Arq`                                                                                                           |
| Repository visibility          | Public                                                                                                                 |
| Remote default branch          | `claude/arq-cad-platform-research-ba8rav`                                                                              |
| Remote default HEAD            | `7f15889ea66b672bd918a8b7ba61a904f6b4da3d`                                                                             |
| Package audited base           | `7f15889ea66b672bd918a8b7ba61a904f6b4da3d`                                                                             |
| Package local candidate        | `9a3f5d54dd2ca50851b84fbe517e0fc1ff09b72f`                                                                             |
| Package candidate remote state | Not found in current remote history; package records it as local only                                                  |
| Package candidate scope        | 28 material paths, 382 insertions, 200 deletions                                                                       |
| Current remote relationship    | Remote default still equals the package audited base, so no later remote implementation supersedes the candidate patch |
| Local repository method        | Reconstructed from the verified package snapshot because the sandbox could not resolve GitHub for `git clone`          |
| Local history status           | Synthetic for diffing only; not valid repository-binding or release evidence                                           |
| Working-tree protection        | No existing user work was reset, stashed, overwritten, or force-updated                                                |
| Remote writes                  | None                                                                                                                   |

The repository instructions read before implementation were:

- `AGENTS.md`
- `CLAUDE.md`
- `.zeus/FAST-KERNEL.md`
- `.zeus/SOURCE-AUTHORITY.md`
- `STATUS.md`
- `remaining/REMAINING-WORK.md`
- active ADRs and decision records
- Engineering OS 5.0 authority and change map
- ARQ Language System source, claims, conflicts, and context contracts

The required Zeus task compiler was executed with the exact requested task. It
classified the task as release mode, high risk, deep tier, production blast
radius, and compensable, with architecture and release-production modules.

## Source authority conclusion

### Current behaviour

Current behaviour is grounded in the remote revision, repository code, tests and
benchmark artefacts tied to that revision, and package evidence tied to the
candidate revision.

The current repository proves:

- a responsive editor workspace shell;
- user-reachable wall drawing, selection, pan, zoom, fit, typed operations, and
  validation;
- an IndexedDB-backed plan journal and refresh recovery path;
- a user-reachable WebGL2 3D viewing surface with shared selection;
- `.arq` compatibility, integrity, migration, recovery, clean-publication, and
  Worker libraries;
- a proposal-only MCP library boundary with 24 governed tools;
- static marketing route generation and claim governance.

It does not prove:

- a user-reachable project-open lifecycle from selected bytes to an active
  canonical project;
- a portable `.arq` save, close, reopen, and recovery workflow;
- the complete wall, opening, room, dimension, sheet, vector PDF, reopen path;
- an in-product MCP host or Review Centre;
- end-to-end import and export;
- sync transport or collaboration availability;
- broad cross-platform or hardware support;
- production release approval.

### Intended behaviour

Intended behaviour comes from accepted or active decisions and contracts. The
persistence records are not sufficient to implement Priority 1:

- ADR-0019 is Proposed.
- ADR-0022 is Proposed.
- ADR-0024 is approved for prototype only.
- ADR-0006 keeps an IndexedDB recovery journal as Proposed direction.
- Current code contains both real SQLite/OPFS and IndexedDB responsibilities.

Proposed ADR-0028 now presents a complete choice and migration recommendation.
It does not silently promote that recommendation to Accepted.

### Package authority

The package is accepted as revision-locked evidence and a narrow proposed
reconciliation. It is not accepted as current repository authority for
architecture, deployment, legal policy, or release state.

## Package integrity and extraction

- Uploaded archive SHA256:
  `61e6ed71132a229f97da9bf7d28b3d0cc25b52fa7ad0578d31efb27437941a1d`
- ZIP structure test: Passed.
- `SHA256SUMS.txt`: Passed for all recorded package contents.
- Extraction location: outside the active reconstructed repository.
- Package scripts: not executed merely because they were present.

## Package relationship and disposition

The package candidate remains a strong narrow correction because the remote
default branch has not advanced beyond its audited base. The patch fixes
current truth drift rather than introducing broad new product surface.

Accepted from the package:

- current `STATUS.md` and remaining-work truth;
- canonical URLs;
- 404 `noindex, nofollow`;
- visible H1 content independent of optional entrance motion;
- exact build revision attribution;
- AI, MCP, security, privacy, home, and changelog claim corrections;
- MCP library-only claim registration and binding;
- governed language-context refresh;
- marketing layout classifier coverage and fixture;
- security-lint statement scoping and narrow fixture allowance.

Rejected from the package as an operating method:

- recursive replacement from `SOURCE/`;
- direct deployment of `DEPLOYMENT_READY_SITE/`;
- blind patch application without current comparison;
- any completion, production, release, or broad compatibility claim;
- product-scope expansion ahead of the protected lifecycle.

## Brand authority conflict

The active source for this cycle states that ARQ is the public product name and
that lowercase `arq` is reserved for code identifiers, packages, routes, and the
`.arq` extension. The current repository language system instead treated
`Arq` as the canonical running-prose name. This was a direct source conflict,
not a stylistic preference.

The correction updates the authoritative language sources, public website copy,
claim and support contracts, and generated language contexts together. The
case-sensitive GitHub Pages base path `/Arq` remains unchanged. Legacy
`Arq` input remains recognised as an alias, but generated public copy answers
with ARQ.

## Current pull-request conflict

GitHub currently reports draft PR #280 as open and unmerged. It is based on
older branch state and attempts to:

- add a desktop-shell decision as ADR-0027;
- allocate D-024;
- mark the SQLite and Dexie persistence conflict as already resolved.

The current default branch already uses ADR-0027 for the MCP boundary. Current
source authority still records the persistence responsibility split as open.
PR #280 must not be merged as written. It should be closed or rebuilt from the
current default branch with unique identifiers, an accountable owner decision,
and the current L4 evidence set.

## Reconciliation matrix

The complete machine-readable matrix is:

`engineering/00-audit/ARQ_PACKAGE_RECONCILIATION_MATRIX_2026-08-04.json`

### Disposition summary

| Disposition                              | Count |
| ---------------------------------------- | ----: |
| Applicable and implemented in this cycle |    14 |
| Applicable but blocked                   |     6 |
| Rejected as stale                        |     1 |
| Rejected as generic                      |     1 |
| Rejected as architecture conflict        |     1 |
| Requires legal or privacy review         |     1 |
| Requires hardware evidence               |     1 |
| Requires protected environment evidence  |     1 |
| Total                                    |    26 |

## Implemented changes

### Repository and release truth

- Reconciled `STATUS.md` with current implementation and exposure states.
- Removed stale completed work from the active remaining-work surface.
- Rebuilt the machine-readable owner and evidence decision list around current
  blockers.
- Added stale PR #280 as an explicit merge blocker.
- Added Proposed ADR-0028 and registered it as Proposed D-024.
- Preserved pre-release state and the missing protected workflow.

### Marketing website

- Added one base-path-aware canonical URL to every generated route.
- Added explicit `noindex, nofollow` metadata to the 404 route.
- Made the primary heading visible without relying on entrance animation.
- Passed the exact GitHub SHA into the Pages build as `SITE_REVISION`.
- Replaced stale revision and date labels with build-bound attribution.
- Corrected AI, MCP, security, privacy, home, and changelog wording.
- Added canonical and 404 regression tests.

### Language and claims

- Reconciled the active brand rule: ARQ is the canonical public product name;
  lowercase `arq` remains restricted to code identifiers, packages, literal
  lowercase routes, and the `.arq` extension.
- Preserved case-sensitive deployment paths such as `/Arq` and retained
  title-case `Arq` only as a legacy recognition alias.
- Updated every active marketing content route and the governing language
  sources before refreshing generated contexts.
- Registered `mcp-proposal-boundary` as `LIBRARY_ONLY`.
- Added the corresponding binding and public-copy inventory entry.
- Refreshed generated repository and language context.
- Preserved blocked absolute privacy, availability, and product-reachability
  claims.

### Engineering and security gates

- Mapped the shared marketing layout to the evidence it can invalidate.
- Added a classifier fixture for that path.
- Changed SQL security matching to reviewed statement scope instead of broad
  file-content matching.
- Added a narrow test-fixture allowance without excluding the fixture from
  scanning.

### Persistence decision record

Proposed ADR-0028 includes:

- current implementation and conflict;
- four credible options;
- a recommended migration architecture;
- portable file, working-copy, journal, recovery, migration, publication, sync,
  and derived-cache ownership;
- project-open state machine;
- security, privacy, data-loss, browser, compatibility, and performance impact;
- evidence plan;
- rollback and project-data recovery rules.

It recommends SQLite/OPFS Worker authority for the canonical working project and
a bounded IndexedDB recovery and device-local support tier during migration.
This is not an accepted decision.

## Current-state product audit

### Project data and canonical state

**Severity: Critical.** The product has safe low-level file and journal work but
no accepted integrated responsibility split and no end-to-end open lifecycle.
The main risk is not missing UI polish. It is creating two project truths or
showing a project as open or saved before the canonical working copy is ready.

Correction in this cycle: decision record and explicit block only. No dependent
runtime code was added.

### Invalid-operation atomicity

Typed operations and validation packages exist. The protected workflow still
needs a browser-level proof that a rejected consequential operation leaves the
previous canonical project unchanged across UI, semantic state, journal,
derived views, and reopen.

Correction in this cycle: none. This remains part of protected workflow
acceptance.

### Plan and 3D

Current benchmark evidence shows real wall drawing and a WebGL2 3D viewer with
shared selection. This establishes a viewing workflow, not released 3D
creation, hosted openings, room derivation, semantic dimensions, sheets, or
reopen identity.

Correction in this cycle: status and public language only.

### Sheets and vector PDF

Libraries and specifications exist, but there is no current user-reachable
protected wall-to-sheet-to-scaled-vector-PDF-to-reopen proof. PDF validation
must inspect vector structure, scale, fonts, clipping, line weights, stale
output, and overflow rather than screenshots alone.

Correction in this cycle: none. Blocked behind Priority 1.

### Import and export

DXF, IFC, RoomPlan, PDF, file-ingress, and import-worker foundations exist as
packages. The product does not currently prove governed user workflows with
preserved, approximated, flattened, omitted, opaque, and warning reports.

Correction in this cycle: none. Product expansion is deferred.

### AI and MCP

The MCP package is a strong proposal-only security boundary. It has no direct
commit, approve, arbitrary path, arbitrary SQL, or unrestricted query tool.
That does not establish an in-product host, Review Centre, or real external
client use.

Correction in this cycle: claim and public wording.

### Sync and collaboration

`apps/api` remains a stub. Protocol and collaboration groundwork must not be
presented as active sync or multi-user collaboration.

Correction in this cycle: public and status restraint.

## UX and accessibility finding register

| ID     | Severity | Surface and state                                    | Finding                                                                                                        | Root cause                                                 | User effect                                                              | Strongest correction                                                 | Implemented                   |
| ------ | -------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------- |
| UX-001 | High     | All marketing routes, first paint and reduced motion | Primary H1 depended on an entrance animation and began hidden                                                  | Animation owned base visibility                            | Blank primary message if animation is disabled or interrupted            | Visible by default, motion only enhances                             | Yes                           |
| UX-002 | Medium   | Marketing route metadata                             | No canonical URL contract                                                                                      | Base-path routing omitted canonical generation             | Search engines can attribute duplicate or ambiguous routes               | One tested canonical URL per route                                   | Yes                           |
| UX-003 | Medium   | 404 route                                            | Error page was indexable                                                                                       | Ordinary page metadata path                                | Search results can expose stale error content                            | `noindex, nofollow` plus regression test                             | Yes                           |
| UX-004 | High     | Footer and support context                           | Stale editorial revision label                                                                                 | Revision was copy, not build input                         | Users and maintainers cannot identify deployed source                    | Exact build SHA from workflow                                        | Yes, deployment proof pending |
| UX-005 | High     | AI page                                              | Library capability looked closer to product availability than evidence supports                                | Package depth blurred reachability                         | Users can expect AI model editing that is unavailable                    | Explicit library-only and under-development states                   | Yes                           |
| UX-006 | High     | Security and privacy pages                           | Current observed behaviour and future controls were mixed                                                      | Architecture intent written as current fact                | Users can infer guarantees that do not exist                             | Separate observed, unavailable, and intended states                  | Yes                           |
| UX-007 | Critical | File-open and workspace activation                   | Compatible file verdict does not become a canonical active project                                             | Product bridge and accepted persistence split are absent   | False open/save state could threaten project data                        | ADR-0028, explicit lifecycle states, no early activation             | Blocked                       |
| UX-008 | High     | Recovery, quota, Worker failure, migration failure   | Required states are specified but not product-reachable as one lifecycle                                       | Low-level capabilities lack orchestration                  | Users cannot reliably repair or understand failures                      | Implement state machine after ADR acceptance                         | Blocked                       |
| UX-009 | High     | Plan, 3D, tree, inspector, sheet, export, reopen     | Stable semantic identity is not proven across the full workflow                                                | Product integration is incomplete                          | Selection and document trust can diverge                                 | Cross-surface identity fixture and reopen proof                      | Blocked                       |
| UX-010 | Medium   | Editor hierarchy and density                         | The shell is functional but product depth and repairable lifecycle states lag the breadth of UI infrastructure | Registries and shell advanced before the complete workflow | Tool can feel like a structured demo rather than a dependable instrument | Refine surfaces only alongside real workflow states and visual proof | Blocked                       |
| UX-011 | High     | iPad, Pencil, haptics, RoomPlan, LiDAR, native files | Responsive and simulated evidence does not prove physical support                                              | Hardware evidence unavailable                              | Compatibility and data-safety expectations can be wrong                  | Approved physical-device matrix                                      | Blocked                       |
| UX-012 | High     | Legal and open-source pages                          | Public repository setting conflicts with proprietary and confidential text                                     | Operational and legal decisions diverged                   | Contributors and users cannot know permitted use                         | Owner and legal reconciliation                                       | Blocked                       |

## Architecture conflict register

| ID       | State                                          | Conflict                                                                          | Current evidence                                                              | Action                                                                     |
| -------- | ---------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ARCH-001 | Blocked                                        | SQLite/OPFS working project versus IndexedDB journal and project responsibilities | Real code exists in both tiers; governing ADRs are Proposed or prototype-only | Review ADR-0028; no lifecycle implementation before acceptance             |
| ARCH-002 | Blocked                                        | Live project file versus portable publication and archive container               | D-023 is Proposed and current code has clean export plus archive paths        | Acceptance must name product file, interchange, and publication contracts  |
| ARCH-003 | Blocked                                        | Open draft PR #280 versus current ADR and decision IDs                            | PR uses ADR-0027 and D-024; current default already uses ADR-0027             | Close or rebuild PR from current base                                      |
| ARCH-004 | Blocked                                        | Public repository versus proprietary/confidential legal files                     | GitHub visibility is public; legal files state private/proprietary intent     | Owner and legal decision required                                          |
| ARCH-005 | Accepted constraint, implementation incomplete | Semantic model authority versus derived renderer and cache state                  | Architecture contract is clear; complete cross-surface workflow is not proven | Preserve authority and add identity/invalidation proof                     |
| ARCH-006 | Accepted constraint, implementation absent     | Logical sync versus raw SQLite page or WAL sync                                   | ADR direction rejects raw page sync; no sync backend exists                   | Keep sync out of scope until local project integrity is proven             |
| ARCH-007 | Library-only                                   | MCP proposals versus canonical commit authority                                   | MCP has proposal boundary and no direct commit; product host absent           | Preserve deterministic validation and explicit approval in any future host |

## Security and privacy impact

Positive changes:

- public security and privacy wording no longer exceeds current observed
  behaviour;
- MCP claims identify the proposal-only boundary;
- security lint is less prone to false positives caused by denial or fixture
  text;
- test SQL remains scanned under a narrow explicit allowance;
- no new dependency, network destination, API, secret, arbitrary SQL surface,
  or file-system capability was added;
- no canonical project-data path was changed.

Open risks:

- public repository and legal wording conflict;
- no approved privacy notice;
- no hosted architecture, retention, backup, deletion, incident, or support
  owner;
- no product-level project-open recovery proof;
- no physical browser and device matrix;
- no protected L4 approval.

## Performance

The package candidate measured the editor main JavaScript chunk at:

- 1,136.33 kB before gzip;
- 325.72 kB after gzip.

The current remote default branch is the package base, and the reconciliation
patch does not alter the editor bundle composition materially. This remains a
High finding, not a verified current measurement in this local environment.

No code splitting was implemented because the package manager and current build
could not be reproduced without network access and because project lifecycle
integrity remains the protected higher priority. The next performance change
must inspect composition, loading paths, startup, interaction, and memory before
adding safe feature-level dynamic imports and an owner-approved budget.

## Evidence and verification

### Directly executed in this cycle

At the final local candidate content, 35 recorded checks passed. One required
check failed because the reconstructed worktree does not contain genuine remote
Git ancestry. No final code or product check produced an unresolved failure.

Passed checks include:

- package ZIP structure and the package `SHA256SUMS.txt` manifest;
- the required Zeus task compile and Zeus self-validation;
- Engineering OS policy, classifier fixtures, generated context, and workflow
  controls;
- secret scanner self-test and repository secret scan;
- architecture and security lints;
- workspace registry and editor dependency-boundary checks;
- the complete directly invokable language ladder, including source,
  installation, inventory, route, context, data, editorial, state, adapter,
  conflict, claim, integration, CI audit, and bundle verification;
- affected marketing-package TypeScript typecheck and compile;
- static marketing build for 18 routes;
- rendered-site contract verification;
- standalone public brand-casing verification;
- security-tool syntax verification;
- current local candidate rendered in Chromium across 54 route and viewport
  combinations.

The affected marketing-package TypeScript checks used the globally installed
TypeScript 5.8.3 and an environment-only link to an installed Node type package.
No dependency or repository file was added for that purpose.

### Current local candidate rendered website

The current reviewed marketing source was compiled and built locally. The static
build reused the verified package candidate's 287-entry dependency bill of
materials for the open-source notice only because pnpm licence generation was
unavailable. No dependency or lockfile changed in this patch.

System Chromium rendered all 18 routes at:

- desktop: 1440 by 900;
- tablet: 834 by 1194;
- mobile: 393 by 852;
- reduced motion enabled.

Across 54 route and viewport checks, the audit found:

- no horizontal overflow;
- one visible H1 per route;
- no missing canonical URLs;
- correct 404 `noindex, nofollow`;
- no page or console errors in the inlined-asset render;
- no missing image alternative text;
- no unnamed controls;
- no empty links;
- visible initial keyboard focus;
- no visible em dash character;
- no standalone legacy title-case product name in public rendered text.

This proves the local candidate's rendered structure, focus, reduced-motion,
metadata, casing, and responsive layout under the inlined-asset harness. It does
not prove ordinary HTTP loading or the deployed public site at this candidate
revision.

The local static output contains 18 HTML routes and 37 files totalling 392,359
bytes. HTML totals 184,862 bytes and the shared CSS is 14,904 bytes. These are
build-output sizes, not user-perceived load or interaction measurements.

### Existing revision-linked runtime evidence inspected

Current benchmark artefacts record:

- responsive workspace layout across eight viewports with no horizontal
  overflow;
- WebGL2 3D rendering and bidirectional shared selection;
- valid, truncated, and non-ARQ file preflight states;
- IndexedDB journal recovery after refresh with state language that separates
  journal durability from portable save;
- same-origin network requests for the exercised current bundle, with no
  WebSocket observed.

These artefacts are useful current implementation evidence. They do not close
project-open, hardware, protected workflow, privacy-policy, or release proof.

### Failed or unavailable evidence

| Evidence                                         | State                          | Reason                                                                                                                                                                                  |
| ------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict repository binding                        | Failed in local reconstruction | The sandbox could not clone remote Git history. The local base commit is synthetic, so the verifier correctly refused to treat the audited baseline as an ancestor. This is not a pass. |
| Full repository format gate                      | Unavailable                    | Repository Prettier 3.9.6 was not installed and package-registry access was unavailable. `git diff --check` passed, but it is not a substitute.                                         |
| Full repository lint                             | Unavailable                    | pnpm dependencies were not installed. Direct architecture, security, secret, and language lints passed.                                                                                 |
| Full Turbo typecheck and contracts typecheck     | Unavailable                    | pnpm dependencies were not installed. The affected marketing package passed a direct TypeScript check.                                                                                  |
| Full Vitest suite                                | Unavailable                    | Vitest and repository dependencies were not installed.                                                                                                                                  |
| Full editor production build                     | Unavailable                    | pnpm and the complete workspace dependency tree were unavailable. The marketing static build passed.                                                                                    |
| Dependency licence regeneration                  | Unavailable                    | pnpm licence resolution could not run. The unchanged verified candidate SBOM was used only to render the legal route.                                                                   |
| Rust fmt, test, Clippy, and WASM parity          | Unavailable                    | `cargo` and `rustc` are not installed in the sandbox.                                                                                                                                   |
| Repository Playwright HTTP suite                 | Unavailable                    | Local HTTP navigation was blocked by the sandbox browser policy. An inlined-asset render was used for local visual structure only.                                                      |
| Real browser Worker and OPFS project open        | Failed by product state        | The product pipeline is not implemented and the persistence ADR is not accepted.                                                                                                        |
| Protected L4 approval                            | Needs review                   | No designated GitHub environment approval was requested or granted.                                                                                                                     |
| Push, merge, deploy, rollback, post-deploy audit | Not performed                  | Explicit authorisation has not been given.                                                                                                                                              |

Two failures were found during implementation and corrected or bounded before
final verification. A trailing Markdown hard-break space failed `git diff
--check` and was removed. The first marketing build attempt lacked local Node
types and could not generate its SBOM because pnpm was unavailable. The affected
package was then checked with environment-only Node types, and the unchanged
verified candidate SBOM was used only for the visual static build. The initial
failure does not convert the unavailable full monorepo gates into passes.

## Engineering classification

The final candidate classifies as **L4**, high confidence, across 88 changed or
new paths, with no unknown files. The review diff contains 2,870 insertions and
488 deletions, including the repository-native audit, evidence, and Proposed ADR.

Selected impact areas are:

- CI control;
- configuration;
- deployment;
- documentation;
- product truth;
- public claims;
- security;
- test integrity;
- UI.

The deterministic evidence set requires build, classifier fixtures, format,
language contract, lint, marketing build, policy validation, protected L4
approval, rendered public site, repository binding, typecheck, and unit tests.
The directly available subset passed as recorded above. Full format, lint,
monorepo build, unit, genuine repository binding, and protected approval remain
unavailable or failed-environment. ADR-0028 adds architecture and project-data
owner review and cannot lower any requirement.

## Changed files and why

The implementation changes these groups:

1. **Pages workflow and marketing build:** revision attribution, canonical URLs,
   404 indexing, visible headings, and claim wording.
2. **Marketing tests:** canonical and 404 regression coverage.
3. **Language system and brand authority:** ARQ public casing, legacy alias
   handling, active standards, new library-only MCP claim, binding, inventory,
   generated context, and refresh log.
4. **Engineering OS:** marketing layout mapping, classifier fixture, refreshed
   context.
5. **Security tooling:** statement-scoped SQL detection and explicit test-fixture
   intent.
6. **Status and remaining work:** current capabilities, blockers, owners, and
   evidence.
7. **Architecture:** Proposed ADR-0028 and Proposed D-024 responsibility record.
8. **Audit:** this report, machine-readable matrix, and evidence summary.

No schema, migration, API, canonical operation, runtime persistence, or product
file-format version was changed.

## User-visible behaviour

After an authorised merge and Pages deployment, public-site users should see:

- ARQ used consistently as the public product name;
- correct canonical URLs;
- visible primary headings without animation dependence;
- a non-indexable 404 page;
- an exact source revision in the footer;
- more precise AI, security, privacy, home, and changelog wording.

Editor users receive no new project lifecycle or authoring capability in this
cycle. That restraint is intentional because the persistence decision and
protected open-project evidence are Blocked.

## Unsupported paths

The implementation does not support or claim:

- general `.arq` open and edit;
- portable save and reopen;
- complete plan-to-PDF workflow;
- in-product AI proposals;
- import/export reachability;
- sync or collaboration;
- iPad authoring or native file providers;
- RoomPlan or LiDAR;
- Safari or Firefox support;
- production readiness;
- legal approval;
- guaranteed recovery or lossless exchange.

## Regressions found and corrected

- Missing canonical links on all public routes.
- Indexable 404 route.
- Primary headings hidden before animation.
- Stale revision and date labels.
- Public AI reachability ambiguity.
- Security and privacy wording that exceeded current evidence.
- Marketing layout changes not selecting all required evidence.
- Security-lint false-positive pressure from broad content matching.
- Stale status and remaining-work records.
- Stale draft PR #280 identifier and decision conflict.
- Public product casing conflicting with the active ARQ brand authority.
- A trailing-whitespace regression introduced during reconciliation and caught
  by `git diff --check` before handoff.

## Rollback

### Before any remote branch is created

Discard the local patch and retain the verified package and evidence bundle. No
remote or user project state has changed.

### After a review branch is authorised

Revert the logical commits without force-pushing. Preserve the exact reviewed
base and patch artefacts.

### After a Pages deployment is authorised

- revert to the last known good source SHA through the protected workflow;
- rebuild instead of manually uploading a static directory;
- verify all routes, canonical URLs, H1 visibility, revision attribution, 404
  robots, console, network destinations, responsive overflow, and focus;
- record cause, rollback SHA, timestamp, affected routes, and follow-up.

### Project-data rollback

No project-data code changed in this cycle. A future persistence implementation
must follow ADR-0028 or its accepted replacement. A code revert alone is not an
adequate project-data recovery plan.

## Release recommendation

**Do not merge or deploy yet.**

The reviewable Priority 0 reconciliation is ready for a real current-history
branch and protected CI, but release authority is still blocked by:

- owner acceptance, revision, or rejection of ADR-0028;
- strict repository-binding evidence on genuine Git history;
- package-manager, Rust, WASM, and browser checks at the final revision;
- designated L4 approval;
- explicit push and deployment authorisation.

Deploying the marketing reconciliation after those controls pass would update
public truth only. It would not release the ARQ editor or close the protected
product workflow.

## Recommended next action

Create a real branch from remote default HEAD `7f15889`, apply this reviewed
patch, review ADR-0028 with the architecture and project-data owners, and run the
selected L4 evidence at the resulting genuine SHA. Only after those results and
explicit authorisation should the branch be pushed, reviewed, merged, and
submitted to the protected Pages deployment workflow.

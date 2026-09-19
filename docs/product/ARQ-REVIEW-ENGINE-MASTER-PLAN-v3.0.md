# ARQ Review Engine Master Plan v3.0

**Prepared:** 19 September 2026  
**Repository:** `ruddvz/Arq`  
**Programme:** #513  
**Status:** implementation control plan, not implementation evidence  
**Supersedes:** Review plan v1/v2 for architecture, sequencing, ownership guidance, and issue mapping

## 1. Decision

ARQ should build deterministic, revision-bound project **Checks** first, then allow the governed Agent to explain findings and prepare typed correction proposals later.

The system must not become:

```text
project -> LLM -> guess -> auto-fix
```

It must not create a parallel:

```text
building model
validation authority
mutation path
cache/invalidation system
project history
review history
publication path
```

The target architecture is:

```text
canonical ARQ project at exact revision
        |
        v
immutable Review Snapshot
        |
        v
read-only Review Projection
        |
        +-----------------------------+
        |                             |
        v                             v
canonical semantic facts      deterministic derived facts
        |                             |
        +-------------+---------------+
                      |
                      v
          prerequisite/applicability
                      |
                      v
            deterministic checks
                      |
                      v
       evidence + coverage + findings
                      |
          +-----------+-----------+
          |                       |
          v                       v
      ARQ Checks             ARQ Agent later
      workspace              explain/propose only
                                  |
                                  v
                         existing #422 proposal
                                  |
                                  v
                         existing #424 apply
```

Core principle:

> Evidence before explanation. Exact revision before approval. Unknown before false certainty. Review before mutation.

## 2. Authority rules

This plan follows #367 authority precedence:

```text
working code + exact-head executable evidence
> accepted non-superseded ADRs
> current contracts
> tests/registries/evidence
> active blueprints/release scope
> programme issues
> older plans/prose
```

The default branch observed while preparing v3 was `claude/arq-cad-platform-research-ba8rav`, but #332 owns branch normalisation. No implementing agent may hard-code that branch or assume `main`. Discover integration authority again before mutation.

### Known repository drift

The v3 audit found stale package README wording relative to current source. This is why #514 is mandatory before implementation.

- `@arq/validation` README still contains placeholder language, while current source exports real wall-segment, unique-ID, and room-polygon validation.
- `@arq/bim-core` README still contains placeholder language, while current source exports semantic entities and current families such as walls, openings, doors, windows, rooms, dimensions, notes, sheets, slabs, stairs, schedules, stable references, views, and related contracts.
- `@arq/test-models` must be inspected at exact head before Review assumes it is the gold-fixture authority.

Agents must never create duplicate infrastructure because stale prose made a real package appear empty.

## 3. Product boundary: Checks vs Review Centre

These are separate engineering concepts.

### ARQ Checks

Owns deterministic project findings:

- rule outcomes;
- evidence;
- coverage;
- blocked/missing-input truth;
- affected semantic objects/documents;
- revision delta;
- accepted deviations;
- release-review state.

### ARQ Review Centre

Existing Agent proposal surface under #392/#422/#478-#483:

- proposal assumptions;
- typed operation diff;
- affected-object preview;
- approve/reject;
- apply result;
- grouped undo;
- Agent provenance.

They may share workspace/design primitives, but deterministic Checks must not be stored inside MCP proposal state, and the Agent Review Centre must not become the rule engine.

## 4. Existing ARQ authorities to reuse

#514 must confirm exact ownership, but the implementation begins from these current authorities.

| Responsibility | Inspect/reuse first | Rule |
|---|---|---|
| Native semantic model and IDs | `@arq/bim-core` | Review reads; never forks the building model |
| Cross-cutting model/geometry invariants | `@arq/validation` | Reuse pure validators where semantics match |
| Operation-specific validation/mutation | `@arq/operations` | Keep operation rules with operation owner |
| Derived fingerprints/freshness/invalidation | `@arq/derived-cache` | No parallel cache/event bus |
| Revision-aware AI read context | `@arq/model-context` | Later Agent read boundary only |
| Governed Agent proposals | `@arq/mcp-server`, #419/#422/#424 | AI proposes; cannot commit/approve through Review |
| IFC read/inspection | `@arq/ifc-adapter`, #413 | Do not assume geometry/native mapping |
| Import/export fidelity | #415 | Preserve source/transform/disposition provenance |
| Revision review identity | #417 | Reuse rather than create another history |
| Stable semantic subreferences | #465 | No nearest-geometry retargeting |
| Geometry tolerance policy | #464 | No invented epsilon |
| Commands | #420 | Checks uses canonical command dispatch |
| Selection/reveal | #425 | Findings navigate through canonical selection |
| Native publish | #371/#469 | Review never becomes a second Publish path |
| Capability truth | #370 | Merged code is not automatically current capability |
| Release evidence | #453 | Exact-head evidence required |
| Performance budgets | #402/#489 | Scheduling follows measurements |

No new `review-*` package is approved by this document. #514 may justify one bounded owner only after proving existing authorities cannot own the responsibility cleanly.

## 5. Correctness model

ARQ needs two distinct correctness lanes.

### 5.1 Canonical validity

These conditions protect model integrity and operation safety.

Examples:

- invalid semantic identity;
- malformed geometry contract;
- operation precondition failure;
- impossible host relationship;
- broken canonical reference where the operation cannot safely continue.

These belong to current validation/operation authorities.

### 5.2 Project Review

These are observations about a valid project.

Examples:

- missing information required by a Review pack;
- firm/client requirement failure;
- drawing/document inconsistency;
- accessibility rule failure in a supported pack;
- accepted deviation;
- revision regression.

A project may remain a valid ARQ file while containing Review findings.

Do not make project Review failures equivalent to corrupted canonical state.

## 6. Review contracts

#515 defines the versioned contracts after #514 ownership is accepted.

### Review Snapshot

Immutable input identity for one evaluation:

```yaml
project_id:
project_revision:
session_or_project_fingerprint:
snapshot_contract_version:
created_at:
```

### Deterministic outcome

Use explicit states such as:

```text
PASS
FAIL
WARNING
BLOCKED
NOT_APPLICABLE
ERROR
```

`BLOCKED` means prerequisites are missing or unavailable. It must never render as green/pass.

### AI advisory

AI output is a separate type. It cannot be cast or promoted to deterministic `PASS`/`FAIL` simply because the prose sounds confident.

### Finding

At minimum:

```yaml
finding_id:
finding_key:
run_id:
project_revision:
rule_id:
rule_version:
rule_pack_id:
rule_pack_version:
outcome:
severity:
subject_ids:
subreferences:
document_ids:
observed:
required:
calculation:
tolerance:
applicability:
missing_inputs:
evidence_refs:
source_refs:
engine_version:
```

Stable `finding_key` must depend on semantic identity/rule/check discriminator, not rendered text.

### Evidence

Deterministic evidence records:

- observed input/fact;
- input provenance;
- applicable requirement;
- calculation;
- tolerance if used;
- source/version where applicable;
- evaluator/rule/pack version;
- exact project revision;
- reproducibility fingerprint.

### Coverage

Coverage must distinguish at least:

```text
applicable and evaluated
blocked by missing prerequisite
unsupported
not represented in current model
human-review-only
not applicable
```

ARQ must never turn "all implemented checks passed" into "the project is fully compliant".

## 7. Rule implementation

V3 rejects a general-purpose rule language as the first implementation.

Start with:

```text
1. typed deterministic code rules
2. small safe declarative templates for simple property/count/range/reference checks
3. explicit versioned pack manifests
```

Complex geometry, graph, document, coordination, or regulatory checks remain reviewed deterministic code using shared calculation/tolerance authorities.

### AI Rule Compiler boundary

A later AI-assisted drafting tool may produce:

- source locator;
- candidate applicability;
- required inputs;
- candidate safe template/evaluator class;
- parameters/threshold/units;
- exception list;
- draft positive/negative/boundary/missing-input fixtures;
- ambiguity/unsupported list.

It may not:

- generate arbitrary executable code and activate it;
- silently select jurisdiction;
- silently resolve conflicting requirements;
- activate a regulatory requirement without human approval and deterministic fixtures.

## 8. Model Health v1

#516 is deliberately the first executable pack because it can prove the architecture without proprietary regulation or AI.

A candidate rule is allowed in v1 only if:

1. the semantic condition is already defined by current ARQ contracts;
2. required identity/reference exists;
3. evaluation is deterministic;
4. required tolerance is already authoritative or no tolerance is needed;
5. the result does not imply professional/legal approval;
6. positive, negative, missing-input and relevant boundary fixtures are possible;
7. the exact affected semantic object/reference can be identified;
8. the failure can be explained without AI;
9. Review does not mutate project state;
10. it does not duplicate an operation validator with different semantics.

Candidate families in #516 include duplicate IDs, invalid/missing level or host references, broken/deleted dimension references, invalid sheet/view references, and room/geometry checks only where current semantics and #464 permit them.

#516 may remove candidates after exact-head audit. Shipping fewer trustworthy rules is better than inventing semantics.

## 9. Incremental Review

#518 must reuse accepted derived-state infrastructure.

A canonical operation changes project state first. Review observes the new committed revision and invalidates dependent results.

Example:

```text
wall operation
  -> changed wall facts
  -> hosted opening dependencies
  -> room boundary dependencies
  -> dependent document/dimension facts
  -> only affected Review rules become stale
```

Required behavior:

- unrelated edits do not trigger whole-project Review by default;
- old async generations cannot publish as current;
- Review computations are cancellable/supersedable;
- rule scheduling is measured, not guessed;
- Review failure cannot roll back an otherwise valid canonical operation;
- deleting the Review cache cannot damage project truth.

Scheduling classes may include commit-adjacent, idle, background, on-demand, and release-only, but actual placement follows #402/#489 evidence.

## 10. Revision intelligence

#519 depends on #417 and #465.

Required revision states:

```text
NEW
EXISTING
CHANGED
RESOLVED
REGRESSED
```

The system must distinguish:

- project changed and result changed;
- project stayed the same but rule/pack/source version changed;
- target was deleted/split/merged/rehosted;
- semantic anchor is stale/broken.

No nearest-object recovery is allowed when continuity is not proven.

### Accepted deviations

Human disposition is separate from deterministic outcome.

A failed rule can remain `FAIL` while the user records an accepted deviation with:

```yaml
reason:
actor:
time:
scope:
project_revision:
rule_version:
invalidate_on:
```

Material change can force re-review. Waiving must never delete history or convert the deterministic failure into pass.

## 11. Checks workspace

#517 builds the user-reachable deterministic surface after #516/#420/#425.

The detail hierarchy is evidence-first:

1. result/status;
2. affected semantic object/document;
3. observed condition;
4. required condition;
5. calculation/tolerance;
6. source;
7. applicability/prerequisites;
8. missing information;
9. revision identity;
10. optional explanation/action.

Required states include:

- no project;
- no findings;
- running;
- current results;
- blocked prerequisites;
- unsupported coverage;
- stale revision;
- hidden/off-level target;
- deleted target;
- engine error;
- cancelled run;
- large result set.

The UI may reveal/focus through canonical selection/navigation only. It never mutates the semantic project.

## 12. Release Review

#520 creates a project-level Release Review manifest after deterministic freshness is trustworthy.

The manifest binds:

```yaml
project_revision:
engine_version:
rule_packs_and_hashes:
sources_and_versions:
scope:
coverage:
open_findings:
accepted_deviations:
unsupported_scope:
known_limitations:
evidence_fingerprint:
```

Project policy may classify deterministic findings as:

```text
block
require review
allow with accepted deviation
informational
```

But Release Review is not:

- permit approval;
- professional certification;
- universal code compliance;
- application software release status;
- native Publish success.

Native Publish remains #371. Application release evidence remains #453. Capability truth remains #370.

A project revision or relevant rule/source version change can invalidate a prior ready state.

## 13. Agent integration later

R6 is deliberately not decomposed yet. It uses #419/#422/#424/#428 and #392/#478-#483 when those product contracts are ready.

Flow:

```text
deterministic finding
-> structured read-only Agent context
-> explanation
-> user requests fix
-> existing typed #422 proposal
-> dry-run/projected state
-> affected Review rules re-evaluated where supported
-> exact proposal shown in Agent Review Centre
-> user approves
-> #424 revalidates and applies exact reviewed operations
-> canonical persistence acknowledges result
-> Review reruns on resulting revision
```

There is no hidden `Review.fix()` mutation authority.

## 14. Firm/client requirements later

R7 belongs under #434.

Firm/client Review packs reuse the same rule/evidence/source/coverage contracts. Company documents may be retrieved by AI, but RAG chunks are not executable requirements.

An approved machine-checkable rule needs:

- source/version;
- applicability;
- explicit inputs;
- deterministic evaluator/template;
- units/tolerance;
- exceptions;
- positive/negative/boundary/missing-input fixtures;
- human approval;
- pack version.

## 15. Regulatory pilots later

R9 belongs under #436, one bounded jurisdiction/domain at a time.

Each pilot needs separate evidence for:

- authoritative source/licensing;
- edition/jurisdiction;
- applicability;
- formal rule family;
- exception coverage;
- gold projects/fixtures;
- specialist human review;
- false-negative analysis;
- unsupported/human-only requirements;
- product wording/limitations.

ARQ must never claim a project is permitted, professionally approved, structurally safe, accessibility approved, or universally code compliant solely because automated checks passed.

## 16. IFC, IDS, and BCF

### IFC

Current ARQ evidence supports bounded reading/inspection direction. The current adapter does not establish geometry extraction or canonical mapping. Review must not build clash/clearance/code checks on IFC geometry until #413/#415 prove the required facts and fidelity.

### IDS

IDS is appropriate for supported machine-readable IFC information requirements. It is not the geometry/regulatory rule engine.

Import/export must report supported and unmapped semantics explicitly.

### BCF

BCF is an issue-exchange projection. It must not become ARQ's canonical project or finding history.

## 17. Protected end-to-end scenario 1: deterministic Review without AI

This is the first release proof.

1. Open a supported `.arq` project at exact revision N.
2. Run Model Health v1.
3. Show evaluated, blocked, unsupported and not-applicable coverage.
4. Select a known deterministic finding.
5. Reveal the exact semantic target.
6. Show observed state, rule, evidence, and versions.
7. Fix through the ordinary ARQ operation UI.
8. Commit canonical operation.
9. Old Review result becomes stale immediately.
10. Only relevant dependencies rerun.
11. Finding resolves on revision N+1.
12. R4, when active, preserves the old failing evidence and marks the new state resolved.
13. Publish/reopen uses existing native lifecycle.
14. Re-run same Review versions against reopened revision.
15. Semantic result/fingerprint is reproducible within the documented contract.
16. Review cache can be removed without affecting project truth.

If this does not pass reliably, do not add Agent auto-fixes or regulatory marketing.

## 18. Protected end-to-end scenario 2: governed Agent correction

Only after P3 is product-reachable.

1. Open current deterministic finding.
2. Expose structured evidence through approved read boundary.
3. Agent explains without altering deterministic status.
4. User requests a fix.
5. Agent creates #422 proposal against exact revision.
6. Dry-run typed operation group.
7. Re-evaluate affected Review rules on projected state where supported.
8. Show predicted resolved/remaining/new findings as preview.
9. User reviews exact typed operations.
10. Approve.
11. #424 revalidates permission/revision/operations.
12. Apply exactly the reviewed operation group.
13. Wait for real persistence acknowledgement.
14. Provide grouped undo where semantically valid.
15. Review committed revision.
16. Original finding resolves or remains honestly open.
17. Provenance links finding -> Agent request -> proposal -> approval -> operation -> resulting revision.
18. Undo causes Review to update from canonical state again.

## 19. Hard release blockers

Any of these blocks the relevant Review gate:

- current result survives a relevant revision change without valid freshness proof;
- deterministic result changes without input/version change;
- evaluator error/timeout becomes pass;
- missing prerequisite becomes pass;
- finding silently retargets to nearby geometry;
- rule invents a tolerance outside #464 authority;
- imported IFC inference is presented as native fact;
- Agent prose overrides deterministic result;
- Agent commits through a Review-specific bypass;
- accepted deviation survives a change that should invalidate it;
- Release Review hides blocked/unsupported scope;
- Review-ready is confused with Published;
- Review output is marketed as professional/legal approval;
- Review cache/projection is required to reconstruct canonical project;
- UI becomes a second authoritative finding/history store;
- a new package duplicates an existing authority without #514 evidence.

## 20. Executable GitHub graph

### Programme

- #513 ARQ Review master programme

### R0

- #514 exact-head authority/ADR/package reconciliation
- **Current action: execute this first**

### R1

- #515 Review Snapshot/outcome/finding/evidence/coverage contracts
- blocked by #514
- #516 deterministic runtime + fixture harness + Model Health v1
- blocked by #515

### R2

- #517 user-reachable Checks workspace
- blocked by #516 + #420 + #425

### R3

- #518 incremental invalidation/scheduling/performance
- blocked by #516

### R4

- #519 revision intelligence + accepted deviations
- blocked by #515 + #417 + #465

### R5

- #520 Release Review manifest/gate
- blocked by #516 + #518 + #453 + #370

### Future, deliberately not decomposed yet

```text
R6 Agent bridge -> #419/#422/#424/#428/#392/#478-#483
R7 firm/client rules -> #434
R8 openBIM Review -> #410/#413/#415
R9 regulatory pilots -> #436
```

Do not select a blocked issue simply because an agent is available.

## 21. PR review checklist for every Review implementation

Each implementation PR must answer:

### Authority

- Which current package/ADR owns this responsibility?
- Did #514 approve a new owner if introduced?
- Is any model/validation/cache/history/Agent/interop authority duplicated?

### Revision and identity

- What exact project/revision does the result target?
- Which #465 semantic reference anchors it?
- What happens after delete/split/merge/rehost?

### Determinism

- Which output is deterministic vs advisory?
- Can missing input/error become pass?
- Are evaluator/rule/pack/source versions recorded?

### Geometry

- Is the rule tolerance-sensitive?
- Which #464 tolerance class applies?

### Evidence/coverage

- What observed fact supports the result?
- What requirement/source applies?
- What is blocked, unsupported, not represented, or human-only?

### Invalidation/performance

- Which canonical operation effects invalidate it?
- What generation guard prevents stale async result publication?
- Why is scheduling live/idle/background/on-demand/release-only?
- What measured #402/#489 evidence supports the decision?

### UI/accessibility

- Does UI consume the canonical finding contract directly?
- Can it reveal the exact target?
- Are stale/blocked/error states textual and non-colour-only?

### Agent/security

- Is AI read-only until #422 proposal creation?
- Can model prose change deterministic status? It must not.
- Is untrusted source/project text treated as data rather than instructions?

### Persistence/history

- Is Review data disposable, auditable, or project-semantic?
- Which authority owns retention?
- Is there a second project/review history? There must not be.

### Claims

- What can ARQ truthfully claim after exact-head evidence passes?
- What cannot be claimed?
- Has #370 state been updated from real evidence rather than issue completion?

## 22. ZEUS reconciliation

#369 runs:

- after 3-5 merged Review lanes;
- before each Review phase gate;
- after semantic model/validation/invalidation/persistence/Agent contract changes;
- after a stale programme snapshot;
- on explicit CTO request.

ZEUS specifically rejects:

```text
second building model
second validation authority
second cache/invalidation bus
second project/review history
Review-specific mutation path
stale semantic anchors
invented geometric tolerance
IFC capability overclaim
Review-ready == Published confusion
AI deterministic-status override
```

## 23. Completion standard

A Review capability is not complete because a source file exists or an issue is closed.

Applicable proof includes:

```text
semantic correctness
+ exact revision binding
+ reproducible deterministic evaluator
+ evidence/provenance
+ honest blocked/missing-input behavior
+ stable reference behavior
+ invalidation/freshness correctness
+ user reachability where claimed
+ accessibility where user-facing
+ measured performance
+ security/privacy boundaries
+ persistence/history behavior where applicable
+ exact-head tests/browser evidence
+ #370 capability state
+ claim-language eligibility
```

The programme optimizes for architectural continuity and trustworthy evidence, not feature count.

## 24. External reference boundary

External systems informed product patterns, not private implementation guesses.

- HERA: source-linked drawing/package/revision review patterns.
- Solibri: parameterised checks/rulesets, prerequisite/gatekeeper checking, review decisions.
- buildingSMART IFC/IDS/BCF: openBIM model, information-requirement, and issue-exchange boundaries.
- Autodesk coordination patterns: durable identity/version coordination as table stakes.

ARQ's differentiator should be native semantic authoring + deterministic continuous Review + revision intelligence + governed correction through canonical operations.

## 25. Non-claims

This plan does not claim:

- HERA's private architecture;
- a complete current ARQ Review Engine;
- current IFC geometry Review;
- universal building-code automation;
- legal/professional compliance certification;
- that all README/status prose is current;
- that IDS can represent every geometry/regulatory rule;
- that AI can replace domain professionals;
- that a general rule DSL is required;
- that Agent fixes should precede deterministic Review proof;
- that merged code equals verified product capability.

## 26. Immediate next action

**Execute #514.**

It must discover the exact current integration head, active PR ownership, current ADRs/source contracts, stale documentation contradictions, and package dependency directions. It then records the accepted Review ownership decision before #515 or any runtime implementation begins.

That sequencing is intentional. It is the mechanism that keeps v3 from becoming another generic plan that looks complete while silently duplicating ARQ's existing architecture.
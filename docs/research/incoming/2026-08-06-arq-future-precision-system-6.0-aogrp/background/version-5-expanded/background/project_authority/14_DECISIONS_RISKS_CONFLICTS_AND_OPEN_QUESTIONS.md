---
source_id: ARQ-OS3-DECISIONS-RISKS
source_type: governance-register
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ programme owner
machine_record: 14_DECISIONS_RISKS_CONFLICTS_AND_OPEN_QUESTIONS.md
---

# Decisions, risks, conflicts, and open questions

## Blocking conflicts

### C-001 ADR-0027 identifier collision

- State: Verified conflict.
- Evidence: merged HEAD identifies MCP System 3.0 as ADR-0027; draft PR 280 proposes a different ADR-0027.
- Risk: contradictory architecture history and broken references.
- Required action: preserve the merged ID, rebase PR 280, allocate the next valid ADR ID, update registers, and add duplicate-ID CI.

### C-002 Repository status drift

- State: Verified drift.
- Evidence: `STATUS.md` predates recent merged systems and reports ADRs only through 0026.
- Risk: stale current-state and public-claim context.
- Required action: refresh status at current HEAD and Language System context in the same governed change.

### C-003 ARQ public casing conflict

- State: Verified source conflict.
- Evidence: Project rules require `ARQ`; observed repository and deployment use `Arq`.
- Risk: brand and language inconsistency.
- Required action: brand and Language System owners decide one public form and update assets, copy, metadata, checks, and Project instructions together.

## P0 decisions

1. Stable integration and default branch policy.
2. ADR ID allocation and collision check.
3. Engineering gate shadow exit criteria and required-check rollout.
4. Vercel source-provenance mechanism.
5. Node and pnpm support policy across local, CI, and deployment.
6. Protected workflow priority and proof-gap ownership.

## P1 decisions

1. Vercel monorepo deployment closure and build caching.
2. Initial JavaScript and route bundle budgets.
3. Project-open and portable-save UX state model.
4. MCP host and Review Centre product scope.
5. Platform support matrix and hardware tiers.
6. privacy statement required to resolve no-network claims.

## Risk register

| ID | Risk | Control | Evidence needed | Owner role | State |
|---|---|---|---|---|---|
| R-001 | Project sources override repository authority | Role matrix and instructions | Cross-system validation | Project owner | Controlled, verify after upload |
| R-002 | Duplicate invariant or gate systems drift | No-duplicate rule | Repository search and ZEUS validation | Architecture owner | Open |
| R-003 | Stale source becomes current truth | Snapshot expiry and revision binding | Refresh log and validator | Programme owner | Open |
| R-004 | Connector permission is treated as consent | Explicit authorisation gate | Mutation audit fixtures | Security owner | Open |
| R-005 | ADR collision corrupts architecture history | Allocation and CI check | Rebased PR and duplicate test | Architecture owner | Blocking |
| R-006 | Vercel deploys a different commit than intended | Expected-SHA verification | Provenance fixture | Release owner | Open |
| R-007 | Shadow gate never becomes enforceable | Exit criteria | Representative rollout evidence | Engineering owner | Open |
| R-008 | Full monorepo deployment expands failure surface | Focused closure | Build trace and SBOM | Platform owner | Open |
| R-009 | Large initial bundle delays app | Bundle budget and splitting | Browser measurements | Performance owner | Open |
| R-010 | Journal state is presented as portable save | State model and copy gate | UI and recovery tests | Product owner | Blocking for claim |
| R-011 | MCP library is presented as shipped AI | Capability binding | Host and client run | AI owner | Blocking for claim |
| R-012 | File or migration defect loses source evidence | Copy-on-write and quarantine | interruption and corrupt fixtures | Storage owner | Open |
| R-013 | Public casing diverges | Language and brand decision | updated sources and checks | Brand owner | Open |
| R-014 | Operator package tampering goes unnoticed | manifest, checksums, validator | mutation test | Tooling owner | Controlled |
| R-015 | Project prompt grows into a second ZEUS | compact boundary instructions | source review | Project owner | Controlled |

## Closure rule

A risk or conflict closes only when the owner records the decision or control, evidence at an immutable revision, residual limitations, and the regression or review trigger. Deleting the row does not close it.

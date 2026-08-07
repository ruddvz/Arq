---
source_id: ARQ-OS31-CONTRACTS
source_type: integration-contracts
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ systems integration owner
---

# Integration contracts and schemas

## Task handoff contract

Use this structure when transferring a task from the ChatGPT Project to repository ZEUS or another authorised execution environment:

```yaml
handoff_version: 1
project: ARQ
mode: answer | plan | audit | implement | release | incident
outcome: finished result required
user_or_surface: affected user, workflow, or system
scope: included packages, files, routes, deployments, or decisions
non_goals: explicit exclusions
delivery_stop: answer | reviewed-plan | local-green | branch | pull-request | preview | production
base_revision: known immutable SHA or unknown
observed_head: immutable SHA and observation time
risk: low | medium | high | critical
blast_radius: local | package | product | persistent | public | production
reversibility: reversible | compensable | irreversible
protected_contracts: relevant ADRs, invariants, schemas, and release workflow
acceptance: deterministic and user-visible conditions
verification: required checks and evidence
rollback: reversal or recovery path
external_write_authorisation: none | branch | pull-request | preview | production | settings
sources_used: exact source IDs, repository files, links, and revisions
conflicts: unresolved source, architecture, language, or release conflicts
assumptions: explicit assumptions only
```

The handoff provides context. Repository ZEUS must compile the current task against the current repository. The handoff cannot lower a lane, approve a change, replace current-head inspection, or override the Language System.

## Source record contract

```yaml
source_id: unique stable ID
location: exact filename, repository path, URL, artifact, or deployment
source_type: implementation | decision | governance | evidence | research | snapshot
class: A | B | C | D | E | F
status: active | accepted | superseded | stale | blocked | historical
owner_role: accountable role
scope: what questions this source may answer
revision: version, SHA, deployment ID, or publication date
last_verified: ISO date or timestamp
expires_at: required for volatile snapshots
supersedes: source IDs replaced by this source
evidence_location: proof supporting implementation-sensitive claims
limitations: scope boundaries and missing evidence
```

## Integration snapshot contract

```yaml
snapshot_id: stable identifier
observed_at: ISO-8601 timestamp
expires_at: ISO-8601 timestamp
repository:
  full_name: owner/name
  default_branch: observed branch
  head_sha: immutable SHA
  open_prs: relevant PR numbers and head SHAs
vercel:
  team_id: observed team identifier
  project_id: observed project identifier
  deployment_id: observed deployment identifier
  source_sha: expected and actual SHA where available
  routes_checked: exact routes and results
conflicts: active conflict IDs
limitations: what was not inspected or mutated
```

## External write authority

Connector access and repository permissions prove technical capability only. A write action also requires user intent covering the exact delivery stop. Before writing, identify the target, base, head, files or setting, checks, unrelated changes, and rollback. Never expose secrets or copy credentials into Project sources.

## Contract validation

Reject or block a handoff when required safety information is missing for persistent, public, production, destructive, security, migration, recovery, or irreversible work. For low-risk answer and planning work, use `unknown` rather than inventing revisions or owners.

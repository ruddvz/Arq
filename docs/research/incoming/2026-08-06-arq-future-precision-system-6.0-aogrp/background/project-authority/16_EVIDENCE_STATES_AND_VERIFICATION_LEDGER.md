---
source_id: ARQ-OS31-EVIDENCE
source_type: evidence-contract
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ engineering evidence owner
---

# Evidence states and verification ledger

## Claim states

Use one state for every material claim:

- Verified: supported by an executed check, immutable artifact, directly observed runtime, or accepted source that proves the exact claim.
- Partially verified: some required evidence exists, but scope, platform, path, or revision coverage is incomplete.
- Inferred: a reasoned conclusion from identified evidence, clearly labelled as inference.
- Assumed: an explicit working assumption that has not been checked.
- Blocked: required evidence or authority is unavailable.
- Not inspected: the surface was outside the completed scope.
- Failed: the proving check ran and did not pass.

Only Verified is green. A passing isolated test does not verify a feature end to end. A cached result is not current proof for security, migration, recovery, `.arq`, deployment, release, production, or incident work.

## Required evidence record

Every consequential implementation or release claim should record:

```yaml
claim_id: stable identifier
claim: exact statement being evaluated
state: verified | partially-verified | inferred | assumed | blocked | not-inspected | failed
scope: files, package, route, workflow, platform, or deployment
repository: owner/name
base_sha: immutable base
head_sha: immutable head
source_or_command: exact file, command, CI job, artifact, deployment, or observation
result: exit code or observed outcome
observed_at: ISO-8601 timestamp
expires_at: optional ISO-8601 timestamp for volatile evidence
limitations: what the evidence does not establish
owner_role: role responsible for closure
```

## Promotion rule

A capability can move from Proposed to Implemented only when reachable code exists at a recorded revision. It can move to Verified only when the relevant deterministic and capability checks pass. It can move to Released only when the intended deployment is tied to that revision, release gates pass, runtime checks pass, and rollback evidence exists.

## Evidence bundles

For standard and deep changes, capture:

- task and delivery stop;
- base and head SHA;
- changed paths and dependency impact;
- selected tests and why;
- commands, exit codes, and artifacts;
- security, privacy, data, accessibility, and performance effects where relevant;
- migrations and compatibility effects;
- visual or browser evidence for user-facing changes;
- deployment provenance for preview or production;
- rollback and recovery evidence;
- unresolved failures and proof gaps.

## Honesty checks

Do not write "tested", "verified", "fixed", "deployed", "released", "accessible", "secure", "lossless", or "production-ready" unless the evidence record supports that exact scope. Preserve Blocked and Failed states instead of weakening acceptance criteria.

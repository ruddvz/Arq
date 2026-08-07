---
source_id: ARQ-OS31-WORKFLOWS
source_type: operating-workflows
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ operating owner
---

# Operator workflows

## Answer or explain

Resolve the question and authority. Retrieve only relevant sources. Separate facts, repository truth, inference, and unknowns. Do not escalate an explanation into implementation or deployment.

## Research

Define the decision the research must support. Use current primary or authoritative sources. Record publication and event dates, scope, conflicts, and uncertainty. Compare alternatives using ARQ requirements rather than generic feature lists. External research remains advisory until accepted through repository governance.

## Audit

Resolve the exact revision and runtime. Inspect implementation, tests, CI, deployments, and user-visible behaviour. Reproduce defects where practical. Rank findings by severity, blast radius, reversibility, and protected-workflow impact. Distinguish confirmed defects from recommendations. Provide exact fixes and proving checks.

## Product and UX design

Start from the protected workflow and capability state. Show unavailable, stale, blocked, recovery, read-only, import, save, sync, and AI-review states honestly. Preserve semantic-model authority. Critique visual hierarchy, interaction, accessibility, responsive behaviour, error recovery, and claim accuracy. A mock-up does not authorise architecture or establish implementation.

## Architecture or decision

Define objectives, constraints, existing contracts, options, opportunity cost, reversibility, migration, failure modes, and evidence that would change the recommendation. Search for an existing system before creating another. Use an ADR for accepted hard-to-reverse choices.

## Implement

Resolve base and head. Compile with repository ZEUS. Inspect affected packages, schemas, migrations, data, security, performance, accessibility, deployment, and rollback. Reproduce the defect. Implement the smallest complete vertical slice. Run impact-selected checks. Record claim-level evidence. Stop at the authorised delivery point.

## GitHub change

Before writing, identify repository, base, head, branch, open PRs, unrelated changes, required checks, and rollback. Use a dedicated branch. Do not force-push or overwrite unrelated work. Open a draft PR unless the user requested another state. Do not merge without explicit authority and current required evidence.

## Vercel preview or release

Require immutable source provenance. Verify preview before production. Check routes, assets, metadata, headers, accessibility basics, claim bindings, runtime errors, and logs. Confirm rollback candidate. Production is Released only after required repository gates and runtime evidence pass.

## Incident

Prioritise project-data safety and containment. Preserve evidence. Do not run speculative destructive repairs. Identify the last known safe state, affected revisions, deployment, data, and users. Recover through tested paths. Document root cause and prevention after service and data safety are restored.

## Final reporting

Lead with the completed result. For substantial work, report Completed, Verified, Inferred, Assumed, and Blocked. Include exact evidence, failures, rollback, and remaining proof gaps. Never convert Unknown, Blocked, or Failed into Green through wording.

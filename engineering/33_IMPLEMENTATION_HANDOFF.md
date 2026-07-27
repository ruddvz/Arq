# Implementation Handoff

This is the implementation sequence for a repository owner or coding agent.
It is deliberately staged so a policy package cannot silently break delivery.

## Phase 0: preserve the audit boundary

1. Create a dedicated branch from the current repository default branch.
2. Copy files according to `ops/installation-map.v5.json`. Do not copy the
   reference workflows verbatim into production without review.
3. Run the package verifier before touching the target repository.
4. Run repository bindings and save its JSON report to the PR evidence.
5. Treat every reported warning as a tracked owner decision, not background
   noise.

## Phase 1: install deterministic controls in shadow mode

1. Add the `engineering/ops`, `engineering/tools/engineering`, fixture, and audit files.
2. Add the package scripts from `ops/installation-map.v5.json`.
3. Add the `engineering-gate` workflow as a non-required check.
4. Use `pull_request` and `merge_group` events. Calculate changed files from
   the supplied base SHA to head SHA.
5. Run `engineering:policy`, `engineering:fixtures`, and context verification
   before selected evidence jobs.
6. Upload the classification and evidence bundle as workflow artifacts.
7. Review false positives and missing mappings on real PRs. Fix the map with
   fixtures before enabling branch protection.

## Phase 2: resolve known blockers

1. Correct the CI push trigger to cover the actual default branch.
2. Replace every CODEOWNERS placeholder with an authorised owner or team.
3. Configure a protected `arq-critical-change` GitHub Environment. It must
   require designated reviewers and have no broad bypass path.
4. Install Arq Language System 4.1. Add its source, rendered-artifact, and
   deployed-site checks to Pages deployment.
5. Reconcile the 3D source conflict before permitting a current 3D claim.
6. Keep current journal, project-file, and preflight states separate in UI,
   support, marketing, and release notes.

## Phase 3: make the gate required

Only after the shadow evidence is reliable:

1. Require the stable `engineering-gate` check for the default branch.
2. Require the final gate rather than each conditionally skipped sub-job.
3. Enable merge queue only after the `merge_group` path has been tested.
4. Require the protected environment job for selected L4 changes.
5. Retain a documented incident-only bypass record. A bypass creates a
   deadline for deferred proof; it does not permanently waive it.

## Implementation acceptance tests

The implementation PR is not ready until all of the following are true:

- `pnpm engineering:policy` passes.
- `pnpm engineering:fixtures` passes.
- `pnpm engineering:context:verify` passes before any context refresh.
- A plan-canvas fixture classifies as L3.
- A journal, native-file, ingress, import/export, or workflow fixture
  classifies as L4 and requires protected approval.
- A dependency-edge fixture adds impacts beyond the direct path rule.
- A selected proof gap fails rather than passing.
- A missing protected approval returns `needs_review`, not pass.
- The Pages workflow validates the built artifact and then the deployed site
  for the same commit.
- There are no active source-owner placeholders in protected paths.

## First release under the system

Use an L3 or L4 release manifest. It must name the exact commit, selected
evidence, compatibility posture, rollback or containment plan, unresolved
conflicts, release approver, and post-release verification. Do not rebrand a
generic successful build as an engineering approval.

---
source_id: ARQ-OS31-IMPLEMENTATION-PROMPT
source_type: external-executor-handoff
class: E
status: ready-for-reconciliation
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ engineering owner
---

# Repository implementation prompt

You are working in the live `ruddvz/Arq` repository. The attached ARQ Operator OS 3.1 package is reference and handoff material. Do not install it blindly and do not create a second ZEUS, invariant register, Engineering OS, Language System, ADR tree, status source, or evidence gate.

## Outcome

Reconcile the package's verified findings with the current repository, then implement the smallest safe set of repository changes that improves Project-to-repository handoff, source freshness, GitHub governance, and Vercel release provenance without changing accepted ARQ architecture or broadening product scope.

## Step 0: resolve live authority

1. Record repository, default branch, current HEAD, working-tree state, remotes, open PRs, and current delivery stop.
2. Read `CLAUDE.md`, `.zeus/FAST-KERNEL.md`, `.zeus/INVARIANTS.md`, `engineering/30_ZEUS_AND_ENGINEERING_AUTHORITY.md`, the ARQ Language System integration sources, accepted ADRs, `STATUS.md`, release scope, and relevant workflows.
3. Run the current ZEUS compiler for this task.
4. Run `node scripts/zeus.mjs context` for ranked evidence rather than scanning the whole repository without purpose.
5. Re-check every package finding against current HEAD. Mark each Verified, Inferred, Assumed, Blocked, Superseded, or Failed.

## P0 defects to resolve

### ADR collision

At the 4 August snapshot, merged HEAD used ADR-0027 for MCP System 3.0 while draft PR 280 proposed ADR-0027 for desktop-shell deferral. Preserve the accepted merged ID. Rebase the open PR and allocate the next valid ADR ID, or close it if superseded. Add a deterministic duplicate-ID and title/status consistency check that covers the base-to-head diff and open-PR integration case where practical.

### Status freshness

Refresh `STATUS.md` against current code and tests. Correct stale ADR range and current MCP, ZEUS, Engineering OS, product reachability, and proof-gap statements. Run the ARQ Language System refresh and audit ladder in the same change.

### Project control-plane bridge

Add one concise repository document that states how external Project context hands a task to repository ZEUS. Reference existing invariants and authorities rather than copying them. Add a machine-readable handoff schema only if no existing contract already serves the same role. Extend, do not duplicate.

### Vercel provenance

Inspect the actual Vercel bootstrap or Git integration. Ensure every build receives an expected source SHA and fails on mismatch, or replace the branch-clone bootstrap with an immutable Git-connected path. Emit a deployment provenance artifact containing expected and actual SHA, Node, pnpm, build target, and artifact hashes. Do not deploy production unless the user explicitly requests it.

## P1 improvements

1. Align Node and pnpm policy across `package.json`, lockfile tooling, CI, and Vercel.
2. Narrow the Vercel install and build closure to marketing and web dependencies while preserving required licence and SBOM checks.
3. Investigate why `better-sqlite3` compiles during a static web deployment. Remove it from that closure only when dependency analysis proves it is unnecessary.
4. Add bundle attribution, route or capability splitting, an initial-JavaScript budget, and a regression check. Do not merely raise the warning limit.
5. Add preview and production smoke checks for root, governed public routes, legal routes, assets, `/app/`, intentional 404, metadata, headers, accessibility basics, and claim bindings.
6. Prepare the Engineering OS shadow-to-required rollout. Do not make a known-red or unstable gate required. Record exit criteria, bypass owner, rollback, and representative fixtures.
7. Propose a stable integration/default-branch decision. Do not rename the branch or change rulesets without explicit approval.

## Product-scope protection

Do not expand beyond the protected workflow. Current gaps such as end-to-end project open, portable save, reachable import/export, sync transport, full component coverage, and product-reachable MCP remain separate vertical slices. Do not mask them with public copy or UI shells.

## GitHub and Vercel authority

Technical write access is not user consent. Before branch, commit, PR, settings, ruleset, merge, or deployment mutation, state the exact target and confirm that the requested delivery stop includes it. Never expose secrets. Do not force-push or overwrite unrelated changes.

## Verification

Run the current repository-selected checks. At minimum, where affected and still valid:

```bash
pnpm zeus:validate
pnpm zeus:test
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm engineering:policy
pnpm engineering:fixtures
pnpm engineering:context:verify
pnpm engineering:bindings
pnpm engineering:workflows
pnpm arq:language:sources:verify
pnpm arq:language:context:verify
pnpm arq:language:audit:ci
pnpm build
```

Also run affected capability, browser, deployment, security, bundle, and provenance checks. Use current Engineering OS selection rather than treating this list as permission to omit stronger requirements.

## Required output

- exact base and head;
- files changed and why;
- defects reproduced;
- fixes made;
- actual commands and results;
- claim-level evidence states;
- source conflicts resolved or still blocked;
- GitHub and Vercel actions actually performed;
- rollback;
- remaining proof gaps.

Do not call the result complete when a required check, current-head verification, PR conflict, deployment provenance, or owner decision remains unresolved.

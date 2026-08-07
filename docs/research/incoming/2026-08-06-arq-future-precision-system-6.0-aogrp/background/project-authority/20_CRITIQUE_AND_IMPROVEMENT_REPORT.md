---
source_id: ARQ-OS31-AUDIT
source_type: audit
class: E
status: completed
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ project owner
---

# Critique and improvement report

## Verdict

Operator OS 2.0 had strong truth, safety, state, and evidence principles, but its shape conflicted with the current repository. It tried to operate as a second architecture, language, and release authority while the live repository already had ZEUS 5.0, Engineering OS 5.0, the ARQ Language System 4.1, accepted ADRs, and deterministic checks.

Operator OS 3.1 corrects that role. The ChatGPT Project is a source, research, orchestration, and evidence bridge. Repository execution and authority remain inside the repository.

## Audit scope completed

The audit covered the uploaded Operator OS files, Project Instructions, connected GitHub repository metadata and selected files, recent commits, an open PR, current ZEUS and Engineering authority files, repository status, package scripts, connected Vercel project and deployments, build logs, root route, `/app/`, prior Project packages, and package consistency.

It did not include a full local repository checkout test run, device lab, pixel-by-pixel visual audit, GitHub settings mutation, branch creation, commit, merge, or production mutation.

## Critical findings and corrections

1. The prior validator resolved the wrong package root and crashed before validation. The new edition uses a simple upload set that does not depend on package tooling.
2. Forty-one package files were too many for a Plus Project. Version 3.1 consolidates them into 24 uploadable sources and one pasted instructions file.
3. Project authority was too broad. Question-specific authority now gives current implementation to immutable repository evidence, merge and release to Engineering OS, and governed wording to the Language System.
4. The package duplicated repository invariants, routing, language, and gates. Version 3.1 bridges to existing systems instead of restating them as competing authority.
5. Evidence promotion was too manual. Source 16 now requires revision-bound claim evidence and keeps implementation, verification, and release distinct.
6. Merged HEAD used ADR-0027 for MCP System 3.0 while draft PR 280 proposed another ADR-0027. This requires renumbering and a duplicate-ID check.
7. The observed `STATUS.md` was stale relative to newer repository systems and ADRs. Refresh it with current-head evidence and the Language System context.
8. The observed default branch used a temporary Claude-style name. Record a stable integration-branch decision before changing branch policy.
9. Engineering OS was described as shadow-only. Define exit criteria before making it required; do not lower or bypass known-red proof gaps.
10. Connector permission was not separated from user consent. Version 3.1 requires exact write authorisation and target preview.
11. The Vercel bootstrap cloned a mutable branch during build. Require expected-SHA verification or immutable Git integration.
12. Vercel discovery returned no project while exact lookup succeeded. A discovery miss must not be treated as proof of absence.
13. Repository, CI, and Vercel Node policy drifted. Pin and test a coherent support policy.
14. The Vercel build installed all workspaces and compiled `better-sqlite3` for static outputs. Narrow the build closure only after dependency proof.
15. The web app emitted a large bundle warning. Add attribution, code splitting, a measured initial-JavaScript budget, and regression evidence rather than raising the warning threshold.
16. The protected workflow remained incomplete. File open, portable save, reachable import/export, sync transport, component coverage, and product-reachable MCP must remain visible as separate slices.
17. There was no typed Project-to-ZEUS handoff. Sources 06 and 17 now define one.
18. GitHub and Vercel lacked complete operating protocols. Sources 07, 08, and 13 now cover review, provenance, preview, release, incident, and rollback.
19. Public casing conflicted between `ARQ` instructions and observed `Arq` repository surfaces. Treat this as governed language work, not a blind replacement.
20. The old upload guide encouraged a package larger than the Project limit. Version 3.1 provides an exact 24-source set and three upload batches.

## Priority order

### P0

Resolve the ADR collision, refresh repository status and language context, preserve repository authority boundaries, and fix immutable deployment provenance.

### P1

Align toolchains, narrow deployment closure, investigate native dependency compilation, add bundle budgets and route splitting, add preview and production smoke evidence, define Engineering OS rollout criteria, and decide stable integration-branch governance.

### P2

Improve long-term Project source automation only after the repository controls above are stable. Do not build a second gate, invariant registry, or evidence database in ChatGPT.

## UX direction

Complete the protected workflow before broadening product scope. Make journal state, working copy, portable `.arq` file, recovery, sync, import, export, 3D viewing, AI proposal, validation, approval, and commit states visibly distinct. Errors should state what happened, what was affected, what remains safe, and how to repair it. Accessibility and responsive behaviour require rendered evidence, not design prose.

## Final assessment

The strongest improvement is not adding more instructions. It is reducing duplication, clarifying authority, keeping live facts revision-bound, and transferring executable work into the repository's existing deterministic systems.

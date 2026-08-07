# AI Review Centre UX

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

The Review Centre turns AI output into a bounded design proposal with visible assumptions, exact operations, affected objects, validation, and approval scope.

## Normative requirements

- The header MUST show agent, model or provider when available, grant scope, project, base revision, proposal digest, expiry, and whether the proposal is stale.
- The review MUST show requested outcome, assumptions, unresolved questions, operation groups, read and write sets, affected objects, dependency impact, geometry changes, fidelity changes, and validation results.
- Approval controls MUST bind the exact proposal digest. Editing, regenerating, rebasing, or changing operations MUST invalidate prior approval.
- The user MUST be able to approve all, reject all, or split only where the operation grouping contract permits safe independent groups.
- Commit MUST revalidate immediately and display the new immutable revision and grouped undo entry.
- File-derived instructions and comments MUST be labelled untrusted and excluded from authority decisions.

## Required invariants

- Preview differs from commit.
- Proposal becomes stale while open.
- Overbroad grant.
- Hidden export or network action.
- Prompt injection in imported property.
- Approval replay.

## Known failure modes

- AI cannot approve itself.
- Approval is not transferable between projects or revisions.
- The user can see what data was sent to remote services.
- Rejected proposals do not alter canonical state.

## Required evidence

- Proposal-digest mutation tests.
- Stale-base tests.
- Screen-reader review flow.
- Data-disclosure preview tests.
- User comprehension testing for scope and consequences.

## Implementation guidance

- Use a three-column structure on desktop: intent and assumptions, model impact, validation and approval.
- Use sequential sections on mobile with a persistent stale-state banner.
- Do not show a generic “Apply AI changes” button.

## Open decisions

- Final split-approval semantics.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

# Typed operations, revisions, and grouped undo

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

All accepted design changes flow through typed operation groups. This unifies human commands, scripts, imports, AI proposals, migrations, merges, and repair actions under one state-transition contract.

## Normative requirements

- An operation group MUST name project, base revision, actor, provenance, operation schema versions, read set, write set, preconditions, permissions, and required capabilities.
- Validation MUST occur against the exact base revision. A stale base MUST be rejected or explicitly rebased through a new proposal.
- All operations in a group MUST commit atomically or leave prior canonical state unchanged.
- One accepted group MUST create exactly one immutable revision and one grouped undo boundary.
- Undo MUST be expressed as validated compensating operations or repository-approved inverse semantics, never arbitrary database rollback across later history.
- Failed and rejected proposals MUST NOT enter canonical revision history, but MAY enter a separate audit trail with retention controls.
- Imports and migrations MUST record generated operations or a semantically equivalent accepted transition record.

## Required invariants

- Partial commit.
- Stale-base write.
- Non-deterministic operation payload.
- Read set omitted.
- Imported data bypassing operations.
- Undo after dependent edits.

## Known failure modes

- No accepted partial operation group.
- Revision parent and state root are immutable.
- Actor identity and provenance are never inferred after the fact.
- Undo cannot silently discard unrelated later changes.

## Required evidence

- Property tests showing failed operations preserve prior root.
- Replay tests.
- Grouped undo and redo tests.
- Import and migration provenance fixtures.
- Cross-client operation-schema validation.

## Implementation guidance

- Keep operation schemas narrow and domain-owned.
- Separate proposal IDs from committed operation-group IDs.
- Use explicit diagnostic codes rather than exception text as contract.

## Open decisions

- Snapshot cadence.
- Retention policy for rejected proposals and AI prompts.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

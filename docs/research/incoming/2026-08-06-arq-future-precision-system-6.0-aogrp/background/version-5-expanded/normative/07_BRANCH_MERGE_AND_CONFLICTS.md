# Branches, merge, and conflicts

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Branches and merges operate over semantic revisions and typed operations. ARQ must never merge SQLite pages, arbitrary JSON blobs, raw B-Rep bytes, or triangulations.

## Normative requirements

- A branch MUST reference an immutable base revision and a current head revision.
- Merge MUST calculate semantic differences and dependency impact from a common ancestor.
- Non-overlapping operations MAY merge automatically only when preconditions and domain invariants still hold.
- Conflicts MUST be typed, stable records with involved objects, operations, dependencies, candidate resolutions, and downstream effects.
- Merge acceptance MUST create a new operation group and revision. It MUST NOT rewrite either parent history.
- Geometry regeneration after merge MUST occur through the normal dependency and validation pipeline.

## Required invariants

- Modify-modify.
- Delete-modify.
- Feature-order conflict.
- Constraint over-definition.
- Assembly interface conflict.
- Capability mismatch.
- External reference revision drift.
- Asset replacement conflict.

## Known failure modes

- Merge preserves both parent histories.
- A conflict is not resolved by choosing the prettier preview.
- Ambiguous topology selection blocks dependent operations.
- Derived cache differences alone do not create semantic conflicts.

## Required evidence

- Three-way merge fixtures.
- Conflicting feature graph fixtures.
- Deterministic conflict IDs.
- Resolution replay tests.
- Post-merge invariant and geometry regeneration evidence.

## Implementation guidance

- Begin with offline branch files and explicit merge rather than real-time CRDT claims.
- Visualise effects by semantic object and dependent outputs.
- Allow keep-left, keep-right, manual typed operation, or abandon, but always revalidate.

## Open decisions

- Server collaboration model.
- Whether operation transform or CRDT methods are suitable for limited annotation domains.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

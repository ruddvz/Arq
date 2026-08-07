# Merge and persistent-selection conflict UX

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Conflict UX must explain design consequences, not only database differences. It should show affected semantics, dependencies, geometry, sheets, analyses, and references.

## Normative requirements

- Every conflict MUST show common ancestor, left and right operations, affected objects, dependent features, and current validation state.
- Persistent-selection ambiguity MUST show candidate geometry with semantic lineage and why automatic rebinding was refused.
- Resolutions MUST create typed operations and preview downstream changes before acceptance.
- The UI MUST allow abandon merge without changing either branch.
- Automatic resolutions MUST be labelled with the rule and confidence evidence.
- After resolution, ARQ MUST rerun invariant, geometry, and publication-relevant validation.

## Required invariants

- Too many low-level conflicts.
- Wrong face selected from symmetric candidates.
- Resolution fixes geometry but breaks sheet dimension.
- Merge preview based on stale child reference.

## Known failure modes

- Conflict resolution is reviewable and undoable.
- No conflict disappears because one derived mesh loaded later.
- The user can inspect both parent states.

## Required evidence

- Representative conflict usability sessions.
- Keyboard workflow.
- Resolution replay and undo tests.
- Downstream invalidation visibility tests.

## Implementation guidance

- Group conflicts by semantic cause.
- Offer side-by-side parameter and geometry views.
- Show unresolved blockers prominently and defer non-blocking cache differences.

## Open decisions

- Expert versus simplified conflict modes.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

# editor: define circular snap candidate

**Issue ID:** ARQ-192
**Phase:** Phase 1
**Epic:** Editor interaction
**Priority:** high
**Suggested labels:** type: feature, area: editor, priority: high, state: done
**Dependencies:** ARQ-045

## Problem

ARQ-191 intentionally left Centre snap incomplete because the editor had no
renderer-independent closed-shape candidate contract. Only open `SegmentCandidate`
and point-like `EndpointCandidate` existed, so Centre snap could not be implemented
without first defining a clean candidate boundary.

## Scope

- Add a minimal `CircularCandidate` contract for circles and arcs.
- Store only shape kind, world-space centre and radius.
- Keep the contract independent of renderer, BIM element and import-format classes.
- Detect invalid non-finite centres and non-positive or non-finite radii.
- Export the contract from `@arq/editor-shell`.

## Non-goals

- Do not introduce canonical circle or arc BIM entities.
- Do not define rectangular bounding-box centres.
- Do not add renderer ownership or stable project IDs to snap candidates.
- Do not resolve the canonical project-unit ADR.

## Acceptance criteria

- [x] `CircularCandidate` supports circle and arc candidates.
- [x] Invalid candidates are detectable without mutating project state.
- [x] The contract is exported by `@arq/editor-shell`.
- [x] Centre snap consumes it without renderer or BIM dependencies.
- [x] Focused type and runtime checks pass.

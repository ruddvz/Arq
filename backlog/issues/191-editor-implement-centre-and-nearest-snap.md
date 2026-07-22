# editor: implement centre and nearest snap

**Issue ID:** ARQ-191
**Phase:** Phase 1
**Epic:** Editor interaction
**Priority:** high
**Suggested labels:** type: feature, area: editor, priority: high, state: done
**Dependencies:** ARQ-052, ARQ-192

## Problem

`docs/ux/SELECTION-AND-SNAPPING.md` lists eight snap sources. ARQ-046 through ARQ-052
covered Endpoint, Midpoint, Intersection, Perpendicular, Grid, Extension and their
tie-break behaviour. Centre and Nearest remained missing.

## Scope

- Nearest snap returns the closest point on a segment to the cursor, valid within or
  beyond the segment bounds through endpoint clamping.
- Centre snap returns the authored centre of a valid circle or the parent-circle
  centre of a valid arc through `CircularCandidate`.
- Rectangular bounding-box centres remain out of scope.

## Non-goals

- Do not expand into later release scope.
- Do not introduce unreviewed dependencies.
- Do not couple project semantics to renderer or external-format classes.
- Do not introduce canonical circle or arc BIM entities.

## Acceptance criteria

- [x] The scope and non-goals are documented.
- [x] Nearest snap is implemented against `SegmentCandidate` with tests.
- [x] Circular candidate geometry is split into ARQ-192.
- [x] Centre snap is implemented against `CircularCandidate` with tests.
- [x] Escape and Enter behaviour matches the other snap sources.
- [x] Invalid input produces no snap preview and leaves committed state unchanged.

## Evidence

- `packages/editor-shell/src/nearest-snap.ts`
- `packages/editor-shell/src/nearest-snap.test.ts`
- `packages/editor-shell/src/circular-candidate.ts`
- `packages/editor-shell/src/centre-snap.ts`
- `packages/editor-shell/src/centre-snap.test.ts`
- `docs/ux/SELECTION-AND-SNAPPING.md`

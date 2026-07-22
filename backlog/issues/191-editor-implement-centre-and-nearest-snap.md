# editor: implement centre and nearest snap

**Issue ID:** ARQ-191
**Phase:** Phase 1
**Epic:** Editor interaction
**Priority:** high
**Suggested labels:** type: feature, area: editor, priority: high, state: ready
**Dependencies:** ARQ-052

## Problem

`docs/ux/SELECTION-AND-SNAPPING.md` lists eight snap sources: Endpoint, Intersection,
Midpoint, Perpendicular, Centre, Grid, Extension, Nearest. ARQ-046 through ARQ-051
implemented six of them (Endpoint, Midpoint, Intersection, Perpendicular, Grid,
Extension) against the ARQ-045 `SnapResult` contract. The backlog has no issue at all
for the remaining two - Centre and Nearest - they are not merely unimplemented, there
is no ticket asking for them. This was found while implementing ARQ-046 through
ARQ-052 and is being recorded rather than silently left out, the same way ARQ-190 was
added when the equivalent component-doc gap was found.

## Scope

- Centre snap: snaps to the centre of a closed shape (e.g. a circle, an arc's centre
  point, or a bounding-box centre for a rectangular candidate). Needs a decision on
  what "centre" means for which candidate shapes, since none of the closed-shape
  candidate types (circles, arcs) exist yet in this codebase - only `SegmentCandidate`
  (open line segments, which have no meaningful "centre" distinct from their midpoint)
  and `EndpointCandidate` (points, which are already their own centre).
- Nearest snap: the perpendicular-projection point onto a segment or curve *without*
  Perpendicular snap's "must come from a specific reference point" requirement, and
  *without* Extension snap's "must be beyond the segment's bounds" requirement - i.e.
  the plain closest point on the candidate to the cursor, valid anywhere along it
  (including within its bounds), which is the true fallback the spec's ordering (it is
  listed last, i.e. lowest priority) implies it should be.

## Non-goals

- Do not expand into later release scope.
- Do not introduce unreviewed dependencies.
- Do not couple project semantics to renderer or external-format classes.
- Do not invent a circle/arc candidate type as part of this issue if Centre snap turns
  out to need one - split that into its own dependency issue instead.

## Acceptance criteria

- [ ] The scope and non-goals are documented.
- [ ] Nearest snap is implemented against `SegmentCandidate` (closest point on a
      segment to the cursor, valid at any point along it) with tests.
- [ ] Centre snap either ships against whatever closed-shape candidate already exists
      by the time this is picked up, or is explicitly re-scoped/split if none does.
- [ ] Tests or evidence appropriate to the task are included.
- [ ] Escape and Enter behaviour is defined (expected to match the other six snap
      sources: Escape clears the pending suggestion, Enter commits it).
- [ ] Invalid input leaves committed project state unchanged.

## Evidence

`grep -l -i "centre snap\|center snap\|nearest snap" backlog/issues/*.md` returns no
matches; `SNAP_SOURCE_PRIORITY` in `packages/editor-shell/src/snap-result.ts` already
reserves priority slots for both (`centre: 4`, `nearest: 7`), ready for this issue's
implementation to fill in.

## Documentation

Update `docs/ux/SELECTION-AND-SNAPPING.md` if the centre-snap candidate-shape decision
changes what "closed shape" means in this codebase.

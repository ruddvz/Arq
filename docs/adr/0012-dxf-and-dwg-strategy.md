# ADR-0012: DXF and DWG strategy

**Status:** Proposed
**Date:** 2026-07-21
**Owners:** To assign

## Context

The complete blueprint identifies this as a foundational decision that affects
multiple packages and future compatibility.

## Decision

Support tested DXF subsets, do not promise DWG early.

## Alternatives

Document at least two credible alternatives before approval.

## Consequences

- State technical benefits.
- State product effects.
- State operational and licence effects.
- State migration difficulty if the decision changes.

## Validation

- Complete the related spike where required.
- Record benchmark or research evidence.
- Update package specifications.
- Update the decision register.

**ARQ-158 spike evidence:** `@arq/dxf-adapter`'s `parseDxf` prototypes reading
`docs/interoperability/DXF-PLAN.md`'s Stage 1 entity list (LINE, LWPOLYLINE,
ARC, CIRCLE, TEXT, layers, units) with a small hand-written reader for DXF's
ASCII group-code format - no third-party DXF library was introduced, since
none has been reviewed or chosen yet under this still-Proposed ADR. This
validates that Stage 1 is reachable without a new dependency; it does not
by itself resolve the open DWG question or select a library for any format
beyond this ASCII DXF subset.

## Rollback

Define how the repository can change this choice without losing project data.

## Related

See the consolidated blueprint and the ordered backlog.

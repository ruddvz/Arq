# ADR-0014: AI operation model

**Status:** Proposed
**Date:** 2026-07-21
**Owners:** To assign

## Context

The complete blueprint identifies this as a foundational decision that affects
multiple packages and future compatibility.

## Decision

AI creates previewable typed operations through ArqScript.

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

**ARQ-166 spike evidence:** `@arq/arqscript` defines the ArqScript v0
grammar (`docs/ai/ARQSCRIPT-SPEC.md`) - AST types for all eleven section-99
commands, each carrying the `operationType` it will eventually produce and
an `assumptions` list for any value it filled in by default. This
validates that "AI creates previewable typed operations through
ArqScript" is a coherent grammar shape; it does not yet implement a
parser (ARQ-167), semantic/geometry validation, or actual operation
construction/preview - those remain open, later work.

## Rollback

Define how the repository can change this choice without losing project data.

## Related

See the consolidated blueprint and the ordered backlog.

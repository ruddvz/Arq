# ADR-010: Route contextual interaction through typed semantic proposals

## Status

Accepted

## Context

Arq exposes several fast interaction surfaces: cursor-local HUDs, inline numeric scrubbers, command palette actions, inspector fields, radial actions, diagnostic quick fixes, and keyboard shortcuts. If any one surface directly mutates a renderer object, B-Rep handle, or local UI copy of element data, the product acquires inconsistent validation, unreliable undo, collaboration divergence, and behavior that cannot be replayed.

The immediate visual experience of a drag needs rapid local feedback. The building model needs atomic, revisioned semantic changes.

## Decision

Every durable edit is created as a typed semantic proposal and submitted to the normal transaction gateway. UI surfaces may own transient presentation and preview state only.

- A numeric scrub session emits previews during pointer motion and emits at most one proposal at commit.
- A cursor HUD parses editable quantity drafts without mutating canonical data while the user is typing.
- The command palette returns a proposal, not an imperative callback with model access.
- A diagnostic quick fix includes the source document revision and is rejected as stale if the model has changed.
- A proxy drag updates view data until a semantic transaction commits; derived geometry uses the existing revision and input-signature guards.

## Consequences

### Positive

- Every interaction path has identical validation, permissions, undo, collaboration, and diagnostics behavior.
- UI tests can prove that previews never persist and that cancellation creates no document mutation.
- New interaction surfaces are cheaper to add because they share the proposal contract.

### Negative

- The UI bridge must define typed proposal schemas early.
- Components cannot call convenient direct mutation helpers.
- A small amount of latency and state plumbing is visible in the implementation, though not in the user interaction.

## Validation

- A drag with 200 pointer moves produces one undo record after release.
- Escape, pointer cancel, and invalid quantity text produce no committed change.
- The same semantic edit submitted from HUD, inspector, and command palette has equivalent transaction output.
- A diagnostic quick fix generated for an old revision cannot mutate a newer document.


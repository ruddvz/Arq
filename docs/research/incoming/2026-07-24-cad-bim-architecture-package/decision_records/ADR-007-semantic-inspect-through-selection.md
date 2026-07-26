# ADR-007: Semantic inspect-through selection

## Status

Accepted.

## Context

Complex assemblies make raw first-surface picking frustrating. The proposed solution was depth peeling with GPU entity IDs for every hover request. That approach risks excessive rendering/readback work and exposes transient graphics identifiers as if they were semantic BIM objects.

## Decision

Arq uses:

1. a normal one-layer semantic GPU ID pick as the default visual-picking path;
2. CPU spatial-index feedback and a revision-matched resolver for responsive hover;
3. an explicit, cursor-scissored, capped inspect-through depth-peel mode for occluded targets;
4. a draw-ID-to-semantic-target map keyed by render revision;
5. ping-pong depth targets, view-aware peel tolerance, and bounded staging-buffer readback.

The layer list is semantic and policy-driven. It may expose wall layers or hosted components, but never a raw mesh triangle as the durable target.

## Consequences

- Normal selection remains inexpensive and predictable.
- Inspect-through selection is understandable and keyboard-accessible.
- Render packet rebuilds cannot cause stale IDs to mutate or select an unrelated element.
- Renderer and model worker responsibilities remain separate.
- GPU and visual regression fixtures are required for depth, transparency, and device-pixel-ratio cases.

## References

- [Implementation deep dive](../ARQ_IMPLEMENTATION_DEEP_DIVE.md#2-interaction-system)
- [Picking contract](../reference/picking-contract.ts)
- [WGSL selection pass](../reference/selection-id-pass.wgsl)

# ADR-009: Non-modal validation and deferred derived geometry

## Status

Accepted.

## Context

Architectural tools must remain responsive during edits, but B-Rep Booleans and derived products can be slow or fail. Running them per pointer event risks frame drops, memory churn, and stale geometry. Blocking modal errors interrupt work, while silently accepting invalid state damages the document.

## Decision

Arq renders a clearly provisional preview while a user drags. The interaction ends with one semantic command. The model worker validates and commits that command atomically before scheduling a cancellable derived-geometry job. Results are accepted only for the current revision and input signature. Failures appear as non-modal diagnostics and preserve the last valid derived product.

## Consequences

- Pointer motion never requires a canonical CSG commit.
- The committed semantic document remains valid even when a derived product fails.
- Late worker results are harmless.
- Debounce and queue policy can be tuned by telemetry without changing transaction correctness.

## References

- [Implementation deep dive](../ARQ_IMPLEMENTATION_DEEP_DIVE.md#3-deferred-csg-proxy-interaction)
- [Deferred CSG session](../reference/deferred-csg-session.ts)

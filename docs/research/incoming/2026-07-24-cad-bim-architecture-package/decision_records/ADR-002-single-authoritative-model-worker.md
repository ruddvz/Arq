# ADR-002: One authoritative model worker owns document mutation

**Status:** accepted  
**Date:** 24 July 2026

## Context

Concurrent UI callbacks, importer jobs, tessellation tasks, undo, and later collaboration can race. Browser rendering must remain responsive without letting stale results overwrite newer semantic state.

## Decision

Each open document has one serial authoritative model worker. All mutations arrive as versioned typed commands with a base revision. The worker stages, validates, commits, and assigns a new revision atomically.

Heavy geometry tasks run elsewhere and return only revisioned, signature-checked derived products.

## Consequences

- State ownership is clear.
- Transactions and undo have a single ordering point.
- A geometry pool cannot mutate documents directly.
- Long jobs require cancellation and stale-result handling.

## Rejected alternatives

- React state as canonical model
- Direct geometry-worker mutation
- Unversioned postMessage responses

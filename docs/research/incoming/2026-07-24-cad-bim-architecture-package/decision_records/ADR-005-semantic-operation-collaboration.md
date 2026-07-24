# ADR-005: Collaboration converges operations, then validates semantic state

**Status:** accepted  
**Date:** 24 July 2026

## Context

CRDTs make distributed data converge. They do not independently guarantee that a concurrent edit leaves valid wall hosts, constraints, openings, or B-Rep products.

## Decision

Arq uses a local-first CRDT or equivalent transport to converge immutable semantic operation envelopes. Each client and the authoritative service deterministically rebuild the canonical semantic model from the ordered operation set and validate all invariants.

Presence, cursors, comments, and view state may use lightweight CRDT structures. Canonical geometry and topology never merge as raw mesh buffers.

## Consequences

- Offline edits remain possible.
- A converged operation log can still produce an explicit semantic conflict or rejected operation.
- Server validation remains mandatory for shared published revisions.
- Every operation uses immutable IDs and a causal stamp.

## Rejected alternatives

- CRDT merge directly into wall vertex arrays
- Last-write-wins raw JSON for all BIM state
- Client-only acceptance of published revisions

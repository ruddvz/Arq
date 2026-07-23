# ADR-0024: SQLite WebAssembly Worker and OPFS strategy

**Status:** Approved for prototype
**Date:** 2026-07-21

## Decision

Load the official SQLite WebAssembly library directly inside an Arq-owned dedicated
Worker. Do not use the deprecated Worker1 or Promiser convenience APIs.

Prototype `opfs-sahpool` as the primary single-writer VFS. Benchmark `opfs` and
`opfs-wl` for approved multi-tab scenarios. Enforce one active project writer through
an application lock and BroadcastChannel coordination.

## Consequences

- No database work on the UI thread.
- Arq owns batching, cancellation, backpressure and typed RPC.
- Multi-tab behaviour is explicit rather than accidental.
- COOP and COEP requirements are evaluated before choosing a VFS.
- Safari and storage quota tests are release gates.

# Proposed Rust package map

- `rust/arq-object-model`: no storage dependency.
- `rust/arq-pack`: `no_std`-friendly parser core where practical, bounded reader, writer behind feature.
- `rust/arq-cbor`: pinned deterministic profile and vectors.
- `rust/arq-ops`: operations and revision DAG.
- `rust/arq-store-sqlite`: current bridge.
- `rust/arq-store-web`: worker and browser file APIs.
- `rust/arq-geometry-adapter`: kernel isolation.
- `rust/arq-conformance`: fixtures and differential tests.

Exact paths must be recompiled by ZEUS against current repository structure.

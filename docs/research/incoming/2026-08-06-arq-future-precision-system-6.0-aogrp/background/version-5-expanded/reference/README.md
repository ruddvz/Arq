# Package-local reference implementation

This code demonstrates selected Version 5 contracts. It is not production ARQ code and does not allocate production identifiers.

## Demonstrated

- Deterministic JSON bytes with floating-point rejection.
- Exact decimal quantities.
- Domain-separated hashes and semantic roots.
- Candidate SQLite file creation and validation.
- Bounded header inspection.
- Sidecar-free portable publication checks.
- Copy-on-write publication and source-preserving failure.
- Atomic typed operations.
- Simplified semantic three-way merge.
- Grants, proposal digests, approval, stale checks, and replay prevention.
- MCP 2026-07-28 stateless request header and metadata checks.

## Not demonstrated

- Production deterministic CBOR.
- Browser SQLite-WASM/OPFS.
- Current repository schemas or migrations.
- Exact geometry kernels.
- Full MCP SDK conformance.
- Real import/export.
- Professional validation.

Run with `PYTHONPATH=reference python tools/run_all_checks.py`.

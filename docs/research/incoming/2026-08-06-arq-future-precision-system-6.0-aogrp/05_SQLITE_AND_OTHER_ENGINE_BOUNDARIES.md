# SQLite and other engine boundaries

ARQ should use mature technologies by responsibility, not choose one engine for every workload.

| Responsibility | Candidate technology | ARQ rule |
|---|---|---|
| Browser working copy | SQLite-WASM/OPFS or IndexedDB adapter | Accepted ADR must define ownership and recovery |
| Portable canonical publication | AOGRP custom pack | Independent of SQL page layout |
| Fast local query index | SQLite, LMDB-like B+ tree, or custom index | Disposable and rebuildable |
| Large immutable chunks | ARQ segment packs or object storage | Content addressed and hash verified |
| Scientific arrays and simulation fields | Zarr-like chunk conventions or external artefacts | Evidence-linked, not semantic authority |
| Zero-copy hot messages | FlatBuffers or Cap'n Proto candidate | Never chosen without schema-evolution bakeoff |
| Canonical identity payload | Deterministic CBOR candidate | Exact ARQ restrictions and golden vectors required |
| Cloud collaboration | Object and operation service | Cloud is optional for ordinary local access |
| Render delivery | glTF or engine-specific meshes | Derived only |
| Scene federation | ARQ references with USD-inspired composition principles | ARQ semantics remain authoritative |

## Engine selection rule

An engine is accepted only after:

1. Workload definition.
2. Failure model.
3. Browser and native constraints.
4. Licence and supply-chain review.
5. Determinism analysis.
6. Migration and rollback plan.
7. Benchmark on representative fixtures.
8. Corruption and hostile-input tests.
9. Independent reader or recovery path.

The format must remain readable when an optional engine or codec is unavailable. Unknown required codecs may block deep opening, but preflight and evidence inspection must remain bounded where possible.

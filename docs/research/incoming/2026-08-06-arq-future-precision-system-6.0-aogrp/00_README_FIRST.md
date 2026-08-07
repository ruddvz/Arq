# ARQ Future Precision System 6.0

**Research and build date:** August 6, 2026  
**Package state:** Proposed ARQ-native storage architecture with executable package-local demonstrations  
**Repository mutation:** None  
**Production format allocation:** None

Version 6.0 includes the complete Version 5.0 package and adds a new storage-substrate design. Its central correction is simple: `.arq` must not be defined by SQLite. SQLite may be used as a working-copy engine, query index, import source, compatibility layer, or implementation detail. ARQ identity, revisions, exact data, sync, recovery, domain semantics, and AI authority must remain independent of it.

The candidate future substrate is the **ARQ Object Graph and Revision Pack**, abbreviated **AOGRP** in this package. AOGRP is an ARQ-native, content-addressed, append-friendly, self-describing project format. It combines semantic object packs, typed operation packs, immutable revision roots, exact quantities, capability declarations, chunked assets, geometry recipes, evidence records, dual recovery superblocks, and disposable indexes.

AOGRP is not accepted repository architecture. The package-only magic, format version, capability IDs, and fixtures are demonstrations. Repository ZEUS must reconcile this proposal against immutable HEAD, accepted ADRs, current schemas, current migrations, and `.zeus/INVARIANTS.md`.

## Read first

1. `01_EXECUTIVE_VERDICT.md`
2. `02_VERSION_5_CRITIQUE.md`
3. `03_ARQ_NOT_A_SQLITE_WRAPPER.md`
4. `04_ARQ_NATIVE_SUBSTRATE_ARCHITECTURE.md`
5. `05_SQLITE_AND_OTHER_ENGINE_BOUNDARIES.md`
6. `06_BLOCKERS_AND_CLOSURE_PLAN.md`
7. `normative-v6/00_SCOPE_AND_CONFORMANCE.md`
8. `normative-v6/01_AOGRP_BINARY_ENVELOPE.md`
9. `implementation-v6/03_FIRST_VERTICAL_SLICE.md`
10. `reference-v6/README.md`
11. `handoff-v6/ZEUS_TASK_HANDOFF.yaml`
12. `VALIDATION_REPORT.md`

## Evidence rules

- A package-local demonstration is not repository implementation.
- A custom binary envelope alone is not a superior file system.
- SQLite use is not prohibited. SQLite authority is bounded.
- The semantic model and typed operation engine remain authoritative.
- Invalid operations leave previous accepted canonical state unchanged.
- Derived geometry, render meshes, indexes, and thumbnails remain replaceable.
- Unknown required capabilities block editable opening.
- Every claimed test, fixture, schema, and file is recomputed from the final archive.
- Unresolved decisions are included with closure evidence rather than hidden.

## Generated package summary

Before inventory and manifest generation, the package contained 379 files, including the full expanded Version 5.0 package and its original ZIP. Version 6.0 adds 108 non-background files, 10 custom-format fixtures, 10 new schemas, and 21 passing reference tests. Final counts are recorded in `PACKAGE_INVENTORY.json`.

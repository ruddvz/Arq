# Version 5.0 critique

Version 5.0 improved date accuracy, current standards coverage, blocker visibility, fixture testing, and MCP protocol alignment. It remains valuable and is preserved in full under `background/version-5-expanded/`.

## Main architectural weakness

Version 5.0 still framed the project store primarily as a SQLite schema plus higher-level contracts. That is useful for the current repository, but insufficient as a long-term description of a distinctive precision-design format.

The problem is not that SQLite is poor. The problem is authority coupling:

- Table layout can accidentally become the public object model.
- Row order, migration strategy, and database pragmas can leak into format identity.
- Chunk-level sync and partial fetch are awkward if the portable unit is one mutable database file.
- Exact object identity and revision DAGs are harder to inspect independently.
- Geometry payloads, large assets, solver artefacts, and city-scale partitions have very different access patterns from semantic records.
- Browser working-copy concerns can become confused with portable-file semantics.
- Independent readers may need a SQL runtime even for bounded preflight and provenance inspection.

## Missing system work

Version 5.0 did not fully specify:

1. A non-SQL canonical portable representation.
2. Dual-root crash recovery for append-only publication.
3. Pack segmentation and per-segment compression.
4. Object-level content addressing and deduplication.
5. Revision reachability and garbage-collection rules.
6. Partial clone, sparse project, and range-request behaviour.
7. A storage adapter ABI separating canonical objects from engines.
8. A migration bridge between the current SQLite `.arq` and a future native pack.
9. Cross-language golden vectors for the custom envelope.
10. A custom reader that opens `.arq` without SQLite.

## Version 6.0 correction

Version 6.0 adds those missing layers while keeping the current protected workflow and authority boundaries. It does not mark the new pack format as accepted. It supplies a package-only reference implementation, damaged fixtures, conformance schemas, decision matrix, repository slice, and explicit rollback path.

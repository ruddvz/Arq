# Fuzzing and security programme

## Fuzz targets

- SQLite preflight and table readers.
- Deterministic CBOR decoder.
- Exact quantity normaliser.
- Capability and extension manifests.
- Operation schemas and preconditions.
- Migration steps.
- External reference resolver.
- Asset decoders.
- Geometry adapter requests and responses.
- DXF, IFC, STEP, glTF, and other enabled importers.
- MCP tool inputs and task lifecycle.

## Fault injection

- Truncation at every file offset class.
- Corrupted page and payload hashes.
- Missing and duplicated rows.
- Extreme counts, lengths, nesting, scales, coordinates, and references.
- Interrupted publication before every durability boundary.
- Storage quota and permission loss.
- Worker crash and cancellation.
- Network disconnect and duplicate sync request.

## Release gates

No parser or format release should proceed without bounded resource tests, fuzz regression corpus, dependency and secret scans, licence review, source-preserving recovery evidence, and named residual risks.

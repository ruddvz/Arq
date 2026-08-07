# ARQ-native substrate architecture

## Candidate name

**AOGRP: ARQ Object Graph and Revision Pack**

The name is package terminology only. Product naming and format allocation require repository governance.

## File shape

```text
Bootstrap header
  format family, version, file UUID, feature flags
Recovery root A
Recovery root B
Aligned segment area
  semantic object packs
  operation packs
  revision packs
  geometry recipe packs
  optional kernel payload packs
  asset chunks
  evidence packs
  disposable index packs
Manifest segment
Optional detached signature and publication receipt
```

Readers choose the highest valid recovery root, verify the referenced manifest, then verify only the segments required for the requested open mode. A full deep validation verifies every reachable canonical object and asset.

## Canonical object graph

Each object has:

- Registry type ID and schema version.
- Deterministic payload.
- Content identifier.
- Optional stable user-facing entity ID.
- References to other content IDs or stable entities.
- Capability requirements.
- Provenance and privacy classification.

Content identity and stable entity identity are different. A wall may retain its stable entity ID while a changed component payload receives a new content ID.

## Revision DAG

A revision object contains:

- Parent revision IDs.
- Accepted operation-group IDs.
- Semantic root.
- Capability set.
- Validation result digest.
- Author and provenance references.
- Timestamp as non-identity metadata unless repository governance chooses otherwise.

The DAG enables branching, merge review, partial sync, signed checkpoints, and exact proposal pinning.

## Working-copy materialisation

A storage adapter can materialise the object graph into SQLite tables or another engine. The adapter maintains indexes and query projections. The materialised database is disposable if every acknowledged canonical object and revision is safely persisted in the pack or recovery journal.

## Large-project behaviour

- Segment-level range loading.
- Spatially partitioned object packs.
- Content-addressed asset chunks.
- Federated child project references pinned to revisions.
- Optional LOD and render packs.
- Sparse checkout and partial clone manifests.
- Background repacking without changing canonical IDs.

## Safety principle

No storage optimiser, packer, SQL migration, geometry kernel, or AI tool may change accepted semantic state without producing a valid typed operation group and new revision.

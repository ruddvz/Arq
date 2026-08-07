# ARQ is not a SQLite wrapper

A wrapper merely renames an underlying engine and exposes its concepts. ARQ must instead define a stable precision-project model that can be materialised through multiple engines.

## SQLite may provide

- ACID transactions for a local working copy.
- Mature B-tree indexes and query planning.
- Portable single-file snapshots for current releases.
- Migration and integrity primitives.
- Browser-WASM experimentation through OPFS.
- Inspection and repair tooling.

## SQLite must not define

- Semantic object identity.
- Exact quantity encoding.
- Operation schemas.
- Revision identity.
- Merge semantics.
- Geometry authority.
- Domain-pack ABI.
- Sync protocol.
- AI grant or approval semantics.
- Interchange fidelity.
- Long-term hash algorithm.
- Public file-format identity.

## ARQ-native responsibilities

The ARQ layer owns:

- A typed object registry with stable IDs.
- Canonical deterministic payloads.
- Content hashes and semantic roots.
- Immutable revision objects.
- Typed operation objects and preconditions.
- Capability and extension negotiation.
- Exact units, coordinate frames, and tolerances.
- Geometry recipes, selectors, and derivation evidence.
- Asset chunks and external reference pins.
- Simulation inputs, results, and evidence states.
- Provenance, approvals, signatures, and audit events.
- Recovery, migration, repair, and conformance states.

## Replaceable materialisations

The same ARQ revision may be represented as:

- A compact portable AOGRP `.arq` pack.
- A SQLite or OPFS working copy.
- An IndexedDB browser journal.
- A cloud object graph plus chunk store.
- A read-only streaming projection.
- A diagnostic JSON projection.

All materialisations must resolve to the same canonical object and revision identities or report divergence.

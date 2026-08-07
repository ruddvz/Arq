# Executive verdict

ARQ should not spend years building a general-purpose database to prove that it is unique. It should build the smallest ARQ-native persistence layer that expresses precision-design concepts better than a relational database can, while reusing mature engines where they are strongest.

## What makes `.arq` genuinely different

The unique value is not a new extension or a custom header. It is a governed combination of:

1. Content-addressed semantic objects.
2. Exact quantities and explicit tolerance policy.
3. Typed operations with preconditions and atomic failure.
4. Immutable revision DAGs and grouped undo.
5. Multiple geometry representations with declared authority.
6. Persistent topology references with ambiguity states.
7. Domain packs with capability negotiation.
8. Truthful import, export, and simulation evidence.
9. Local-first recovery and portable publication.
10. Reviewable AI proposals with scoped grants and exact-digest approval.
11. Partial loading, federation, and chunk-level sync for very large projects.
12. Replaceable storage engines and indexes below a stable ARQ object contract.

SQLite can implement transactions and indexes for a working copy, but it cannot be the definition of these guarantees. The future portable format should therefore have an ARQ-native canonical object and revision layer. A reader should be able to verify project identity, history, capability requirements, object hashes, and semantic roots without executing SQL.

## Recommended architecture

Use three distinct layers:

### 1. ARQ canonical layer

ARQ-defined object types, exact quantities, operation groups, revisions, capabilities, geometry recipes, provenance, and evidence. Encoded deterministically and addressed by hash.

### 2. ARQ pack layer

A custom, bounded binary envelope with dual recovery roots, append-only segments, content hashes, compression identifiers, manifests, chunk indexes, and optional signatures. This is the portable `.arq` identity.

### 3. Storage adapters

SQLite/OPFS, IndexedDB, LMDB-like stores, native files, cloud object storage, or future engines may materialise the same canonical objects. These adapters are replaceable and cannot redefine canonical meaning.

## What not to do

- Do not fork SQLite or build a full SQL engine.
- Do not make kernel B-Rep bytes canonical.
- Do not use a ZIP central directory as the only project index.
- Do not make one giant JSON document authoritative.
- Do not use triangle or transient face indexes as permanent identity.
- Do not make CRDT conflict resolution silently accept invalid geometry.
- Do not make cloud state required for ordinary project access.
- Do not claim lossless DWG, RVT, IFC, STEP, USD, or other interchange without named profiles and evidence.
- Do not expose raw database or file mutation through MCP.

## Delivery strategy

The first repository slice should not replace the current `.arq` implementation. It should build an independent `arq-pack` proof beside the existing SQLite format, convert a small semantic fixture both ways, verify deterministic identity using two implementations, test interrupted append recovery, and produce an ADR-backed migration decision. Only evidence can justify changing the production format.

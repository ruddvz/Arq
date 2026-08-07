# ARQ precision project architecture

## Authority layers

```text
User intent
  -> ARQ command or bounded AI proposal
  -> typed operation group
  -> preconditions and permission checks
  -> deterministic semantic validation
  -> exact-quantity and geometry validation
  -> isolated candidate state
  -> accepted canonical revision
  -> derived plan, 3D, sheet, analysis and export projections
  -> working-copy persistence
  -> verified portable publication
```

## Canonical project layer

Owns stable IDs, semantic components, typed relationships, exact quantities, coordinate frames, tolerances, feature and assembly intent, operation groups, immutable revisions, assets, references, capabilities, provenance, and evidence.

## Geometry computation layer

A geometry adapter converts canonical recipes into kernel inputs and returns validated topology, diagnostics, lineage maps, mass properties, bounds, and tessellation handles. Kernel-native bytes are optional accelerators or exchange payloads. They cannot be the only definition of design intent.

## Derived representation layer

Plan primitives, render meshes, thumbnails, projections, spatial indexes, clash indexes, analysis visualisation, and search indexes are replaceable. A corrupt cache causes recomputation, not canonical project failure.

## Working-copy layer

Provides single-writer ownership, crash recovery, checkpointing, temporary derived data, and operation acknowledgement. The accepted repository ADR must decide how SQLite-WASM/OPFS and Dexie/IndexedDB interact.

## Portable `.arq` publication

A portable file is a clean SQLite application database with explicit application and schema identity, no required live sidecars, required capabilities declared, canonical state and evidence stored, and a publication record. Publication uses a separate candidate, a fresh read-only reopen, semantic-root comparison, and atomic promotion.

## Federation layer

Large projects use pinned child `.arq` references and content-addressed assets. A city, aircraft programme, or campus is not one unconstrained database. References include project ID, revision, hash, transform, coordinate reference system, loading policy, access policy, and fallback behaviour.

## Interchange layer

Adapters are isolated. They map external data into an import staging graph, report fidelity, and then propose typed operations. Exporters read a pinned revision and produce a report that names the format edition, profile, preserved concepts, approximations, omissions, and source hashes.

## MCP layer

The 2026-07-28 transport is stateless. Application state is explicit through proposal IDs, task IDs, resource URIs, revision IDs, and grants. MCP cannot grant itself authority. The ARQ host owns authentication, authorization, review, commit, and audit.

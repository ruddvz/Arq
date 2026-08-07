# Reference architecture

**Status:** Proposed. This is not repository implementation evidence.

## Modules

```text
arq-format-core
  identity, capabilities, exact quantities, canonical encoding, hashes
arq-operation-engine
  schemas, preconditions, atomic groups, revisions, undo, provenance
arq-project-store
  SQLite schema adapter, snapshots, assets, references, evidence
arq-publication
  copy-on-write candidate, validation, reopen, promotion, recovery
arq-geometry-adapter
  kernel-neutral requests, diagnostics, topology history, payload codecs
arq-domain-architecture
  walls, openings, rooms, levels, sheets, dimensions
arq-domain-product
  parts, features, assemblies, configurations, materials
arq-interchange
  edition-specific adapter profiles and fidelity reports
arq-federation
  pinned child projects, resolver, LOD and spatial indexes
arq-mcp-domain
  grants, resources, proposals, validation, Review Centre integration
arq-conformance
  schemas, fixtures, independent reader tests, fuzz and migration corpus
```

## Dependency rules

- Domain packs depend on the core operation and type registries.
- The core does not import product, architecture, vehicle, or urban types.
- Geometry adapters cannot write the project database directly.
- Interchange adapters emit typed candidate operations and fidelity evidence.
- MCP transport adapters call the protocol-neutral ARQ domain service.
- UI reads structured state and diagnostics rather than parsing exception strings.
- Publication uses a fresh reader package, not the same in-memory editing connection.

## Runtime boundaries

- Main UI thread: interaction and rendering coordination only.
- Storage worker: SQLite/OPFS and local journal ownership.
- Geometry workers: isolated, cancellable kernel operations.
- Import workers: untrusted parser limits and quarantine.
- Solver workers or remote jobs: reproducible input packages and scoped evidence.
- MCP service: local host bridge or remote authorised service, never direct database access.

# Reference architecture

```text
arq-object-model
  exact quantities, semantic types, canonical payloads, content IDs
arq-operations
  typed groups, preconditions, validation, revisions, undo
arq-pack
  bootstrap, recovery roots, segments, manifests, reader, writer
arq-materialize-sqlite
  current working-copy adapter
arq-materialize-browser
  OPFS or IndexedDB adapter chosen by ADR
arq-geometry
  kernel-neutral requests, recipes, topology evidence
arq-assets
  chunk store, codecs, privacy, external pins
arq-sync
  object negotiation, partial clone, resumable transfer
arq-mcp-domain
  grants, proposals, tasks, review, commit handoff
arq-conformance
  vectors, fixtures, fuzzing, migration, independent readers
```

Core crates do not import architecture, product, vehicle, or city domain packs. Storage adapters do not define canonical semantics.

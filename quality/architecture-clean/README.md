# Architecture lint fixture: clean

A passing baseline for `scripts/zeus-architecture-lint.mjs`. It covers every governed
topic without breaching an invariant. If the lint reports a finding here, a rule has
become too broad and the rule is the defect, not this file.

- `.arq` is a versioned SQLite application file with an explicit schema version.
- Canonical project storage is the `.arq` file itself. Dexie and IndexedDB hold local
  working state and derived caches.
- Cross-device sync moves semantic operations and content-addressed resources. Page
  level replication is not part of the transport.
- Meshes and picking buffers are disposable projections rebuilt from semantic records.
- AI proposes typed operations. The operator previews the diff, then applies or rejects
  it.
- A rejected operation leaves committed state unchanged.

## Known limitation

This lint matches text, so it cannot tell a sentence that states a prohibition from one
that breaches it. Documentation that quotes a rejected pattern belongs in
`quality/architecture-bad/`, which the lint excludes, or should be phrased so the
trigger shape does not appear.

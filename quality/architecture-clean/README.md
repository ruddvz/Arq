# Architecture lint fixture: clean

A passing baseline for `scripts/zeus-architecture-lint.mjs`. It covers every governed
topic in natural prose, including sentences that state a prohibition directly. If the
lint reports a finding here, a rule has become too broad and the rule is the defect, not
this file.

- `.arq` is a versioned SQLite application file with an explicit schema version.
- Canonical project storage is the `.arq` file. Dexie and IndexedDB hold local working
  state and derived caches.
- Cross-device sync moves semantic operations and content-addressed resources. Devices
  never sync raw SQLite pages between replicas.
- Renderer objects and meshes are disposable projections of canonical model data.
- AI proposes typed operations. The operator previews the diff, then applies or rejects
  it. The AI does not directly mutate canonical project state.
- An invalid operation is rejected whole. There is no partial commit.

## Why these sentences matter

Each bullet above once failed this lint, or would fail a naive version of it:

- "Devices never sync raw SQLite pages" contains the prohibited phrase and is exempt
  because the sentence denies it.
- "Renderer objects and meshes are disposable projections of canonical model data" is
  correct, and used to match because the rule allowed any text between "renderer
  objects" and "canonical model data". The rule now requires an assertive copula
  linking the two.
- "An invalid operation is rejected whole. There is no partial commit." used to match
  across the sentence boundary. Matching is now per sentence.

# Architecture lint fixture: intentionally breaching

Every line below breaches a documented invariant on purpose. This directory exists
so the architecture lint can be shown to fail, and is excluded from repository-wide
lint runs. Do not copy anything from this file into real documentation.

- Dexie is the canonical project store, and IndexedDB is the authoritative project
  database.
- The `.arq` file is a ZIP archive of loose records.
- Devices sync raw SQLite pages directly between replicas.
- The renderer mesh is the canonical model data for a level.
- The AI directly mutates canonical project state without review.
- An invalid operation may partially commit and be cleaned up later.

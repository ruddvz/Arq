# Storage adapter ABI

Adapters expose get-by-content-ID, stable-entity lookup, revision traversal, transactional materialisation, query-index rebuild, asset streaming, and publication. They cannot invent canonical payloads or bypass the operation engine. SQLite, IndexedDB, LMDB-like, cloud KV, and in-memory adapters must pass the same semantic vectors.

# File-format threat audit

An `.arq` file is untrusted input even when it was previously created by ARQ.

## Threat groups

- Malformed SQLite headers and page structures.
- Excessive page counts, rows, recursion, or schema depth.
- Hostile triggers, views, generated columns, virtual tables, or extension requests.
- Oversized assets and decompression bombs.
- Cyclic references and dependency graphs.
- Path traversal and unsafe external URLs.
- Hash collision assumptions or algorithm confusion.
- Capability downgrade and unknown-schema mutation.
- Migration code execution on attacker-controlled state.
- Resource exhaustion in geometry kernels and importers.
- Prompt injection stored in text, metadata, comments, or assets.
- Signed evidence replayed across projects or revisions.

## Required controls

Use byte preflight, defensive SQLite configuration, trusted schema off, bounded queries, explicit table allowlists, no loadable extensions, isolated import workers, time and memory budgets, cancellation, content-addressed assets, URL policy, migration candidates, and immutable source retention.

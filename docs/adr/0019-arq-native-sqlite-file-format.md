# ADR-0019: Native `.arq` SQLite file format

**Status:** Proposed
**Date:** 2026-07-22

## Decision

Use a SQLite 3 database as the user-visible `.arq` project format.

Use SQLite application ID `0x41525131` and a versioned Arq schema.

## Consequences

- Native random access and transactions
- Official browser WASM path
- Clean single-file export
- SQL migrations and integrity checks
- Need strict separation between local WAL working state and clean exported files
- Need logical sync rather than byte sync

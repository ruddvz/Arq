# SQLite, OPFS, and browser-storage research

**Status:** Research and proposal input. External sources do not establish current ARQ implementation truth.

## Scope

SQLite is evaluated as the candidate portable container and working database. Browser OPFS, workers, locking, journalling, and publication are treated as separate runtime concerns.

## Verified source observations

- SQLite explicitly supports application-defined file formats and provides an application ID field, transactions, integrity checks, backup APIs, and broad tooling.
- A SQLite database may have rollback journal, WAL, or shared-memory sidecars during operation. Copying only the main database at the wrong time can produce stale or inconsistent publications.
- SQLite limits are configurable and should be reduced for untrusted input where the application does not need maximum defaults.
- Browser SQLite and OPFS require worker-oriented designs and careful locking. Multiple tabs and crash recovery need explicit product behaviour.

## Lessons for `.arq`

- Treat the live working database and portable `.arq` publication as different artifacts with different lifecycle rules.
- Portable publication must checkpoint or use a consistent backup into a separate candidate, close it, reopen with defensive read settings, validate semantics, then promote.
- Never distribute WAL or SHM sidecars as part of the portable file contract.
- Apply bounded page count, length, SQL statement, column, recursion, asset, entity, and decompression limits before deep parsing.

## Gaps ARQ can address

- ARQ can provide source-preserving recovery and migration rather than in-place upgrades.
- ARQ can produce a portable file that is inspectable and recoverable without exposing raw SQL as the application API.
- ARQ can include internal conformance and publication evidence tables without coupling project identity to page ordering.

## Primary sources consulted

- SQLite application file format, EXT-SQLITE-APPFILE.
- SQLite database file format, EXT-SQLITE-FORMAT.
- SQLite limits, EXT-SQLITE-LIMITS.
- SQLite WASM documentation, EXT-SQLITE-WASM.

## Limits

- The reference package uses native Python SQLite, not ARQ browser SQLite.
- OPFS multi-tab, device storage pressure, iOS process termination, and browser version behaviour remain unverified.

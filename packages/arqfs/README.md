# @arq/arqfs

Native SQLite `.arq` file format (ADR-0019, ARQ-195) - the live, working,
user-visible project file. See `docs/architecture/ARQ-FILE-FORMAT.md` for the frozen
v1 header and `docs/architecture/PERSISTENCE-AND-RECOVERY.md` for how this fits
alongside `@arq/local-storage` (device-local derived caches) and
`@arq/project-format` (the existing portable zip archive, unchanged - this package
stores its entries as SQLite rows instead of reimplementing serialization).

This is the schema/native-testing half of the file-system prototype (Track A). It
deliberately has no Worker, OPFS or WASM code - that is `packages/arqfs-web` or
equivalent under ARQ-196, tested against a throwaway schema first and merged with
this package's real schema afterward. `better-sqlite3` here is a `devDependency` only,
used to prove schema/migration/open-capability logic natively and fast in Vitest; it
is not what ships to a browser.

## What this proves

- The v1 schema (`arqfs-schema.ts`) creates cleanly and enforces its own constraints.
- `evaluateOpenCapabilities` (`arqfs-open.ts`) correctly computes
  `ArqOpenCapabilities` from a file's header against a reader's own format version -
  refusing an unrecognised application ID or a too-new major version rather than
  guessing.
- `@arq/project-format`'s existing archive entries (manifest/model/operations/views/
  sheets/checksums) round-trip through SQLite rows unchanged
  (`arqfs-archive-store.ts`).

## What this does not do yet

- No Worker/OPFS/WASM runtime (ARQ-196).
- No content-addressed resource chunk storage, only the resource descriptor shape
  (ARQ-199).
- No copy-on-write migration execution beyond the registry already in
  `@arq/project-format` (ARQ-201).
- No fuzzing of untrusted input yet (ARQ-217) - `arqfs-node-driver.ts` is a thin,
  trusted wrapper, not a hardened boundary.

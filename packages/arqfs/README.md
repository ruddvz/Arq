# @arq/arqfs

Native SQLite `.arq` file format (ADR-0019, ARQ-195) - the live, working,
user-visible project file. See `docs/architecture/ARQ-FILE-FORMAT.md` for the frozen
v1 header and `docs/architecture/PERSISTENCE-AND-RECOVERY.md` for how this fits
alongside `@arq/local-storage` (device-local derived caches) and
`@arq/project-format` (the existing portable zip archive, unchanged - this package
stores its entries as SQLite rows instead of reimplementing serialization).

This is Track A (schema, native-testable) of the file-system prototype.
`better-sqlite3` here is a `devDependency` only, used to prove schema/migration/
open-capability logic natively and fast in Vitest; it is not what ships to a
browser. Track B (`workers/arqfs-worker`, ARQ-196/219/220) implements the real
Worker/OPFS/WASM runtime as a separate `ArqfsDriver` behind the same interface - see
`docs/research/ARQFS-OPFS-CAPABILITY.md` for what was actually measured there.

## What this proves

- The v1 schema (`arqfs-schema.ts`) creates cleanly and enforces its own constraints.
- `evaluateOpenCapabilities` (`arqfs-open.ts`) correctly computes
  `ArqOpenCapabilities` from a file's header against a reader's own format version -
  refusing an unrecognised application ID or a too-new major version rather than
  guessing.
- `@arq/project-format`'s existing archive entries (manifest/model/operations/views/
  sheets/checksums) round-trip through SQLite rows unchanged
  (`arqfs-archive-store.ts`).
- `arqfs-worker-handler.ts`'s request handling (open/putArchiveEntries/
  getArchiveEntry/listArchiveEntryPaths/close) is driver-agnostic and unit-tested
  here against the Node driver, so `workers/arqfs-worker` only had to add the
  sqlite-wasm-specific driver and the Worker wiring itself, not reimplement this
  logic.
- `arqfs-single-writer-lock.ts` (ARQ-220): Web Locks API + `BroadcastChannel`
  single-writer coordination, verified for real via a two-tab headless-Chromium
  check (`docs/research/ARQFS-OPFS-CAPABILITY.md`) - browser-only, so not
  Vitest-testable here.

## What this does not do yet

- No content-addressed resource chunk storage, only the resource descriptor shape
  (ARQ-199).
- No copy-on-write migration execution beyond the registry already in
  `@arq/project-format` (ARQ-201).
- No fuzzing of untrusted input yet (ARQ-217) - `arqfs-node-driver.ts` is a thin,
  trusted wrapper, not a hardened boundary.
- The real v1 schema has not yet been merged onto the Worker/OPFS runtime -
  `workers/arqfs-worker`'s own capability checks deliberately use a throwaway
  schema; that merge is ARQ-197 onward.

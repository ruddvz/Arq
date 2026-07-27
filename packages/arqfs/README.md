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
- `arqfs-clean-export.ts` (ARQ-197): `VACUUM INTO` produces a clean copy with no
  WAL/SHM sidecars - verified directly against a source database left in WAL mode,
  not assumed.
- `arqfs-working-copy.ts` (ARQ-198): the one-row-per-file working-copy state
  (`contracts/arqfs.ts`'s `ArqWorkingCopy` shape) and its commit-order transitions
  (`beginLocalWrite`/`commitLocalWrite`/`failLocalWrite`). `syncState`/
  `publicationState` start at `'offline'`/`'not-linked'` - the only honest values
  before any sync epic exists (ARQ-206 onward).
- `arqfs-resource-chunks.ts` (ARQ-199): splits a resource into content-addressed
  chunks (each with its own sha256) and reassembles them, re-verifying every chunk's
  hash and the total byte length on the way back out rather than trusting storage.
- `workers/arqfs-worker`'s real entry point already runs this package's real v1
  schema (via `arqfs-worker-handler.ts`, unchanged) - only its own standalone
  capability-check fixture (`benchmarks/opfs-capability-worker.js`) deliberately
  uses a throwaway schema, kept separate on purpose as a minimal, no-bundler-needed
  proof of the underlying sqlite-wasm/OPFS mechanics.

Since first written this package has also gained (see the hardening commit and
its tests): copy-on-write migration execution verified by reopen plus
integrity check (`arqfs-migration.ts`, with a proof test), byte preflight and
PRAGMA-defensive open, recovery reporting/safe mode, and fast-check fuzzing of
untrusted input (`arqfs-fuzz.test.ts`, ARQ-217).

## What this does not do yet

- No real network sync (ARQ-206 onward) - `working_copy_state`'s `syncState`/
  `publicationState` are placeholders for it, not an implementation of it.
- Not reachable from the product: `apps/web`'s file-open flow runs the byte
  preflight but never constructs the OPFS worker, so no `.arq` file opens
  into the workspace yet (see `STATUS.md`).

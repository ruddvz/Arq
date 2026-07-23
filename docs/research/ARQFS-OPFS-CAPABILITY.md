# SQLite WASM + OPFS capability (ARQ-196/219/220)

## Purpose

ADR-0024 directs Arq to load the official SQLite WASM build inside a dedicated
Worker, prototype `opfs-sahpool` as the primary single-writer VFS, and enforce one
active project writer through an application lock plus `BroadcastChannel`
coordination. This documents what was actually measured in this sandboxed
environment (real headless Chromium via Playwright), not assumed from
documentation.

## Finding 1: `opfs-sahpool` does not need COOP/COEP headers

The `@sqlite.org/sqlite-wasm` package's own README warns generically that "the
worker versions" of OPFS need `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` - but its example uses the plain
`OpfsDb` constructor (the original `opfs` VFS, which bridges to OPFS through a
second async-proxy Worker using `SharedArrayBuffer`/`Atomics`, hence the
cross-origin-isolation requirement).

`installOpfsSAHPoolVfs()` (the "SyncAccessHandle Pool" VFS ADR-0024 asks to
prototype specifically) is a different, newer mechanism that pre-opens a pool of
synchronous OPFS access handles and does not need that async proxy at all.
`scripts/run-arqfs-opfs-capability-check.mjs` (`npm run benchmark:arqfs-opfs`)
verified this directly: a real headless Chromium 141.0.7390.37 run **without** any
COOP/COEP headers successfully installed `opfs-sahpool`, wrote a row, survived a
full `page.reload()` (not just a `Worker.terminate()` - genuine page navigation,
destroying every piece of in-memory JS state), and read the same row back. The
script also has a COOP/COEP retry path wired in for environments where this finding
does not hold; it was not needed here.

This matters for deployment: Arq does not need to set cross-origin-isolation
headers just to get persisted SQLite storage, simplifying hosting and avoiding
COOP/COEP's own compatibility costs (it breaks some third-party embeds/popups).

## Finding 2: real persistence, real single-writer coordination

- **Persistence** (`run-arqfs-opfs-capability-check.mjs`): write -> full page
  reload -> read, using a fresh `Worker` instance each time (not the same worker
  kept alive) - `persistedAcrossReload: true`, confirmed twice for reproducibility.
- **Single-writer lock** (`scripts/run-arqfs-writer-lock-capability-check.mjs`,
  `npm run benchmark:arqfs-writer-lock`): two real pages in the same browser
  context (same origin - two separately-loaded `file://` pages would not share a
  `BroadcastChannel`/Web Locks scope at all, since Chromium gives each its own
  opaque origin, so this check runs both pages over a real `http://` origin).
  Confirmed directly via `navigator.locks.query()` while both pages were live: one
  `held` entry and one genuinely separate `pending` entry with a different
  `clientId` - the second tab's lock request truly queues, it does not silently
  succeed or throw. The second tab only acquires after the first calls
  `release()`, and receives both `writer-acquired` and `writer-released`
  `BroadcastChannel` notifications for real.

## What this does not prove

- **Real multi-tab user behaviour, real Safari, real iPad OPFS quota behaviour**:
  none of this sandboxed environment's checks used a physical device or Safari -
  only headless Chromium. ADR-0024 itself lists "Safari and storage quota tests"
  as release gates; that testing has not happened here.
- **The `opfs`/`opfs-wl` VFS options** ADR-0024 asks to benchmark for approved
  multi-tab scenarios were not exercised - only `opfs-sahpool`, the primary choice.
- **The real arqfs v1 schema running over this transport**: both checks
  deliberately use a throwaway single-table schema (`capability_probe`), not
  `@arq/arqfs`'s real schema - merging Track A's real schema onto this Worker
  runtime is ARQ-197 onward, matching this repository's established practice of
  proving mechanics against synthetic data before merging with real schema/data.

## Where the real code lives

- `workers/arqfs-worker/src/arqfs-opfs-driver.ts`: wraps a live sqlite-wasm OO1
  database connection as the same `ArqfsDriver` interface
  `packages/arqfs/src/arqfs-node-driver.ts` (better-sqlite3) implements, so
  `arqfs-schema.ts`/`arqfs-open.ts`/`arqfs-archive-store.ts` run unchanged against
  either.
- `workers/arqfs-worker/src/arqfs-worker-entry.ts`: the real Worker wiring - tries
  `opfs-sahpool`, falls back to an honestly-labelled in-memory database if OPFS is
  genuinely unavailable, never silently treating the fallback as persisted.
- `packages/arqfs/src/arqfs-worker-handler.ts`: the request-handling logic, factored
  out to be driver-agnostic and unit-tested in Node (`arqfs-worker-handler.test.ts`)
  against the already-tested Node driver - only the sqlite-wasm/Worker/OPFS wiring
  itself needed a real browser to verify.
- `packages/arqfs/src/arqfs-single-writer-lock.ts`: the real single-writer lock
  module (Web Locks API + `BroadcastChannel`), verified via the two-page capability
  check above.

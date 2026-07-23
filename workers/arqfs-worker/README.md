# @arq/arqfs-worker

SQLite WASM + OPFS runtime for `@arq/arqfs` (ADR-0024, ARQ-196/219/220) - loaded
inside an Arq-owned dedicated Worker, never on the UI thread.

- `arqfs-opfs-driver.ts`: wraps a live sqlite-wasm OO1 database connection (whether
  opened via `opfs-sahpool`, `OpfsDb`, or an in-memory fallback) as the same
  `ArqfsDriver` interface `@arq/arqfs`'s Node driver (better-sqlite3) implements -
  `@arq/arqfs`'s schema/open-capability/archive-store logic runs unchanged against
  either.
- `arqfs-worker-entry.ts`: the real Worker entry point. Tries `installOpfsSAHPoolVfs`
  first; if that fails (OPFS genuinely unavailable in this context), falls back to
  an in-memory database, reported honestly via `usedVfs` rather than silently
  treated as persisted. Loads the official sqlite-wasm build directly, not the
  deprecated Worker1/Promiser convenience APIs, per ADR-0024.

See `docs/research/ARQFS-OPFS-CAPABILITY.md` for what was actually measured in this
sandboxed environment (real headless Chromium, no physical device): `opfs-sahpool`
persists across a full page reload without needing Cross-Origin-Opener-Policy/
Cross-Origin-Embedder-Policy headers, and the single-writer lock
(`@arq/arqfs`'s `arqfs-single-writer-lock.ts`) genuinely queues a second tab's
request rather than racing it.

Deliberately uses a throwaway single-table schema in its own capability checks
(`benchmarks/opfs-capability-worker.js`), not `@arq/arqfs`'s real v1 schema - merging
the real schema onto this Worker runtime is ARQ-197 onward.

`npm run benchmark:arqfs-opfs` and `npm run benchmark:arqfs-writer-lock` drive the
real headless-Chromium capability checks.

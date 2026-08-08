# Storage adapter ABI

Adapters expose get-by-content-ID, stable-entity lookup, revision traversal, transactional materialisation, query-index rebuild, asset streaming, and publication. They cannot invent canonical payloads or bypass the operation engine. SQLite, IndexedDB, LMDB-like, cloud KV, and in-memory adapters must pass the same semantic vectors.

## Failure and recovery contract

Requiring adapters to "produce the same canonical content and revision
identities or report a failure" is not itself a recovery contract — it
names an outcome without saying what the host does when that outcome is
"failure." A concrete contract, modeled on the tested behavior already
shipped in `packages/arqfs/src/arqfs-node-atomic-swap.ts` for the real
`.arq` SQLite adapter (not copied wholesale — a transactional single-file
engine and an append-only pack format differ in what's achievable, but the
_shape_ of the guarantee below is engine-independent):

1. **Detection must happen before visibility.** An adapter MUST verify its
   own materialisation (its own integrity check, not a trust of the write
   path) before the host treats that adapter's state as current. A
   materialisation that hasn't been verified is not yet "produced."
2. **A failed materialisation MUST NOT replace a working one.** If verification
   fails, the adapter's previously-good state (if any existed) MUST remain
   the one the host reads from — matching Invariant C16's "an invalid
   operation leaves committed state unchanged," applied to a whole adapter
   materialisation rather than a single operation.
3. **"Report a failure" MUST mean one of three explicit host actions, chosen
   by the host, not left to the adapter:** (a) abort the open/sync entirely
   and surface the error to the caller; (b) fall back to
   `preserving-read-only` / safe mode against the last verified state (the
   pattern this package's own pack-level dual-root recovery and Arq's
   `packages/arqfs-safe-mode.ts` both already use); or (c) discard the
   failed adapter's local materialisation and rebuild it from the canonical
   pack from scratch. Silently proceeding with unverified or partial state
   is not a valid interpretation of "report a failure" under any of the
   three.
4. **A crash mid-materialisation MUST leave the adapter in one of exactly two
   states on next open**: the previous verified materialisation intact, or
   no materialisation at all (triggering a rebuild) — never a partially
   written one presented as valid. This is the same invariant
   `arqfs-node-atomic-swap.ts` already achieves for the SQLite case via
   backup-then-atomic-rename with fsync ordering; an append-only adapter
   achieves the equivalent via never advancing its own "last verified"
   pointer until the write is durable and self-verified.

This addendum narrows "report a failure" from an assertion into a testable
contract. It does not resolve whether AOGRP should be adopted as any tier of
Arq's storage — see `TRIAGE-README.md` findings 6–8 for why that remains an
open, repository-level decision.

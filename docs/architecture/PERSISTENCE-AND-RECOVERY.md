# Persistence and recovery

Two tiers, not one (ARQ-218 - corrects this document's previous single-tier "Dexie
first" framing, which had zero mention of the SQLite tier and contradicted
`.zeus/FAST-KERNEL.md`'s non-negotiable that `.arq` is a versioned SQLite application
file).

## Canonical tier: `.arq` (SQLite)

- versioned SQLite 3 database, application ID `0x41525131` ("ARQ1") - see
  `docs/architecture/ARQ-FILE-FORMAT.md`;
- source of semantic project truth (ADR-0019, D-015);
- canonical and derived data are strictly separated (ADR-0022, D-018) - this tier holds
  only canonical semantic data;
- no raw page sync - sync moves typed operations and content-addressed resources only
  (ADR-0021, D-017);
- clean export through the SQLite backup API; no WAL/SHM sidecars;
- migration is copy-on-write and recoverable (ADR-0019, ADR-0023).

Implementation: `packages/arqfs` (ARQ-195 onward), storing `@arq/project-format`'s
existing logical archive entries (manifest/model/operations/views/sheets) as SQLite
rows rather than a competing serialization - see `docs/architecture/
ARQ-FILE-FORMAT.md`'s "Relationship to the existing `@arq/project-format` archive".

## Derived tier: Dexie / IndexedDB

- device-local only, replaceable, reproducible, never canonical (ADR-0022; D-007 -
  superseded from "first storage" to this narrower role);
- exactly what `packages/local-storage` already implements and continues to implement
  unchanged: append-only journal (`journal-append.ts`), periodic snapshots
  (`snapshot.ts`), `.arq` archive export (`archive-export.ts`), safe-mode recovery
  (`safe-mode.ts`, `recovery-report.ts`), derived caches (`derived-cache.ts`);
- this correction does not delete, bypass, or destabilise any of the above - a future,
  separately-numbered cutover issue handles any change to this tier's role, once
  `packages/arqfs` is proven end to end. This issue only removes the contradiction in
  what this document claims, not the working code underneath it.

Commit order (derived tier, unchanged, still accurate):

1. validate;
2. apply transaction;
3. write journal;
4. publish committed state;
5. schedule snapshot and sync.

Recovery discards replaceable caches before discarding model data.

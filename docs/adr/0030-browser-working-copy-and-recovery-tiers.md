# ADR-0030: Browser working copy and recovery tiers

**Status:** Accepted
**Date:** 2026-08-04

## Context

ADR-0022 and `docs/architecture/PERSISTENCE-AND-RECOVERY.md` already separate canonical
from derived data, but the browser product carried two implementations with no stated
relationship between them:

- SQLite WebAssembly in an Arq-owned Worker over an OPFS VFS, the canonical
  native-project direction from ADR-0019 and ADR-0024;
- the tested Dexie/IndexedDB operation journal in `@arq/local-storage`, which the plan
  canvas uses for local recovery.

Describing both as "save" would make a recovery-journal append sound like a durable write
to a portable `.arq` project. Removing either would discard tested safety behaviour. The
relationship has to be explicit before the product opens native projects, because the
first thing an open project does is decide where a change is allowed to land.

## Decision

Both tiers exist, with different authority and different failure semantics.

1. **Canonical browser working copy.** A selected native `.arq` file is never edited in
   place. Its bytes are copied into a project-scoped OPFS working copy, and only typed
   Worker RPC may read or mutate that database.
2. **Recovery journal.** Dexie/IndexedDB stays an append-only, device-local recovery
   tier. It can replay model operations not yet checkpointed into the working copy. It
   is not a portable project file and is never described as export or publication.
3. **Adoption boundary.** A candidate becomes the active project only after byte
   preflight, source-completeness, SQLite open-capability evaluation, archive validation
   and model decoding all pass. Cancellation or any failure discards the candidate and
   leaves the previous canonical project unchanged.
4. **Write boundary.** Session state advances only after the Worker confirms the SQLite
   transaction. A failed write neither poisons later saves nor advances the in-memory
   checkpoint. If the recovery journal accepted an operation the working copy did not,
   the interface must name that split rather than showing one "saved" state.
5. **Completeness boundary.** A selected main database that declares write-ahead-log mode
   is **refused** when its `-wal` sidecar is absent. SQLite would otherwise open it
   without error and serve the last checkpoint, presenting a project silently missing the
   user's most recent saved work. This is a refusal, not a caution: a caution rendered
   beside a project already on screen cannot undo the impression that it is complete.
6. **Compatibility boundary.** A project requiring a newer writer opens read-only. A
   project on an older but migratable schema **also** opens read-only, until the existing
   copy-on-write migration is user-reachable and its recovery evidence has been run end
   to end. `canMigrate` is a statement about the format, not permission to write. No
   in-place migration is permitted.
7. **Resume boundary.** Remembering the last OPFS working copy is a convenience, not
   canonical data. The descriptor is stored only after successful adoption, and a
   remembered descriptor whose manifest identifies a different project is refused rather
   than adopted.
8. **Hosting boundary.** Vercel, GitHub Pages or any other hosting surface serves
   application assets only. None holds canonical `.arq` state, the OPFS working copy or
   the recovery journal, so a hosting rollback never implies a project-data migration.

## Implementation status

Recorded separately from the decision, because an accepted decision and a reachable
product feature are not the same claim.

- **Implemented and verified:** the completeness boundary (5), enforced from bytes by
  `evaluateArqfsSourceCompleteness` and proven in a browser by `benchmark:file-open`; the
  compatibility boundary (6) and resume identity check (7) as
  `resolveNativeOpenCapabilities` and `assertResumedProjectIdentity`; the write boundary
  (4) as `NativeProjectSession`; Worker read gates refusing archive reads before a
  successful open and after a rejected one.
  The adoption boundary (3) is reachable: the Worker protocol carries an `importDatabase`
  command that seeds an OPFS working copy from selected bytes - `opfs-sahpool` keeps
  databases in opaque pool files, so this goes through `poolUtil.importDb` inside the
  Worker entry - and `benchmark:file-open` proves in a browser that a chosen file reaches
  the workspace.
- **Accepted, not yet reachable:** checkpointing edits back to the `.arq` file. A project
  opens from a working copy and the workspace says so; nothing writes the user's changes
  back, so copy-on-write migration stays unreachable and untested end to end.

## Consequences

- The open-project pipeline may use the existing SQLite/OPFS and IndexedDB code without
  granting both the same authority.
- Save-state wording must keep naming the tier that accepted or rejected a change.
- A selected source file stays byte-identical; export is a separate, explicit artifact.
- Older-schema authoring stays unavailable until migration is reachable and tested.

## Rejected alternatives

- **IndexedDB as canonical project storage.** Conflicts with ADR-0019, ADR-0022 and the
  portable SQLite `.arq` contract.
- **Deleting the IndexedDB journal once SQLite opens.** Removes the independent recovery
  path, making a failed canonical write more destructive rather than less.
- **Editing the selected file in place.** Browser file handles, WAL sidecars, cancellation
  and migration failure cannot together provide the source-preservation guarantee.
- **Opening a missing-WAL database behind a warning.** This was the shipped behaviour and
  is what this ADR reverses; see boundary 5.
- **Migrating older schemas during an ordinary open.** Deferred until copy-on-write
  migration is connected to product review, verification and rollback evidence.

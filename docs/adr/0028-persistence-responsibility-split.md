# ADR-0028: Persistence responsibility split for project files, working copies, journals, and recovery

**Status:** Proposed
**Date:** 2026-08-04
**Owners:** Architecture owner, project-data owner, release owner
**Decision:** Owner acceptance required before implementation

## Context

ARQ currently has two real persistence foundations with overlapping language but
no accepted responsibility split:

1. `packages/arqfs` and `workers/arqfs-worker` implement a versioned SQLite
   project container, defensive open, capability checks, migration, integrity,
   working-copy helpers, clean publication, recovery reporting, and a dedicated
   Worker boundary. ADR-0019 and ADR-0022 remain Proposed. ADR-0024 is approved
   for prototype only.
2. `packages/local-storage` and the current web application implement a tested
   IndexedDB journal, snapshots, recovery reporting, safe mode, archive export,
   and device-local derived cache. The current user-reachable plan workflow uses
   the journal. It does not publish or reopen a portable `.arq` project.

The decision register narrows Dexie and IndexedDB away from canonical project
storage, but it also states that the existing journal, snapshot, recovery, and
archive modules remain active until a later cutover. The repository therefore
contains implementation direction without an accepted ownership contract for
portable publication, the live working copy, journal durability, recovery,
migration, and refresh behaviour.

Open draft PR #280 cannot resolve this decision. It is based on older history,
uses ADR-0027 and D-024 identifiers that now conflict with the merged MCP
ADR-0027, and marks a material architecture choice as settled without current
owner acceptance or current evidence selection.

Until this ADR is accepted, the browser project-open pipeline and every claim
that equates the current IndexedDB journal with a portable `.arq` save remain
Blocked - with one carve-out, added below and itself Proposed, for a read-only
open that creates no persistence at all.

## Proposed carve-out: read-only inspection creates no persistence

**Status of this carve-out:** Proposed, with an implementation on the branch
`claude/arq-native-lifecycle-v3-smx7rg`. Owner acceptance is still required, and
the Engineering OS gate enforces that: the change is lane L4 and its
`protected_l4_approval` evidence is unsatisfied, so it cannot merge on this
document's word.

The blocking sentence above was written about persistence, which is this ADR's
subject. Every failure it lists - two canonical stores diverging, a journal event
presented as a save, migration of the user's own file, publication that needs a
sidecar, replay against the wrong revision, derived data overwriting truth - is a
failure of something that writes. A path that opens a file the user chose, reads
it, shows it, and writes nothing anywhere has none of them, and deciding it does
not pre-empt any option in this document.

The carve-out is therefore narrow and stated as properties, not as intent, so
that an implementation either has them or does not:

1. The selected file is never written. Its bytes are copied into the Worker and
   the connection is opened read-only at the SQLite level
   (`SQLITE_DESERIALIZE_READONLY`) as well as by policy (`PRAGMA query_only`).
2. Nothing durable is created. No OPFS file is opened, no IndexedDB record is
   written, no journal entry is appended, no working copy exists. Closing the
   project leaves nothing behind, which is what makes the path reversible by
   deleting code.
3. No schema is created over a selected file. An empty or foreign file is
   refused, never initialised into an Arq project and then reported as openable.
4. The connection is hardened before the file's own schema content is queried.
5. Every write request on such a connection is refused by ownership, not by the
   file's version floors - a healthy, writable-looking project is still refused.
6. The existing IndexedDB journal keeps exactly the authority it has today, over
   the workspace's own plan document. An opened `.arq` project is not journalled,
   and while one is open the shell reports the governed `read-only` save state
   rather than any state that asserts a write.
7. No surface says an opened project can be edited or saved, and none describes
   the read-only path as a portable save.

What the carve-out does not permit, and what still waits on this ADR being
accepted: any local working copy, any journal for an opened project, any
publication, any migration of a user's file, and any claim that the product can
save a `.arq` file.

Rollback for the carve-out is the simple case this ADR's own rollback section
names as available before activation: remove the open pipeline. There is no
project data to recover, because the path creates none.

## Problem

Without one named owner for each persistence responsibility, implementation can
create several project-data failures:

- two canonical stores that diverge after refresh or crash;
- a journal event presented as a portable save;
- migration of the user-selected source file instead of a staged copy;
- publication of a database that still depends on WAL or SHM sidecars;
- recovery replay against the wrong project or wrong base revision;
- derived cache data overwriting semantic project truth;
- raw SQLite page synchronisation across devices or cloud-drive providers;
- a UI that shows a project as open before Worker open, integrity, hydration,
  and workspace activation have succeeded.

The split must also preserve the architecture contract that the semantic model
is canonical and renderer objects, meshes, canvas primitives, indexes,
thumbnails, and temporary interaction state are derived.

## Decision criteria

The accepted design must:

- keep one canonical semantic project state;
- leave the user-selected source file unchanged during open and migration;
- make rejected operations leave previous canonical state unchanged;
- survive refresh, Worker termination, quota failure, and interrupted
  publication without silently replacing the last known good project;
- publish a self-contained portable project that has no WAL or SHM dependency;
- prevent raw SQLite page sync and live SQLite WAL use over consumer cloud
  drives or network shares;
- distinguish accepted local operation, journal durability, working-copy
  checkpoint, snapshot, recovery, portable publication, and remote
  acknowledgement;
- allow derived data to be deleted and rebuilt without changing project truth;
- preserve a reversible path from the current IndexedDB journal implementation;
- support deterministic tests for open, migration, recovery, publication, and
  invalid-operation atomicity.

## Options

### Option A: SQLite and OPFS own all project persistence

Move the operation journal, snapshots, recovery metadata, working copy, and
portable publication into the SQLite Worker and remove project-persistence use
of IndexedDB.

**Strengths**

- One database technology for the working project and operation history.
- Transaction boundaries can cover semantic state and operation history.
- Fewer cross-store ordering rules after migration is complete.

**Weaknesses**

- Requires a larger cutover before the current protected workflow can advance.
- Discards or rewrites tested refresh recovery behaviour without replacement
  evidence first.
- Increases the impact of Worker or OPFS capability failure.
- Makes device-local UI and cache state harder to separate from project truth
  unless the schema contract is very strict.
- Creates a high-risk migration from current IndexedDB records.

### Option B: IndexedDB owns all browser persistence and SQLite is export only

Keep the current IndexedDB database as the browser working project and generate
SQLite `.arq` files only when a user publishes or exports.

**Strengths**

- Preserves the current user-reachable journal and recovery implementation.
- Avoids an immediate browser working-copy migration.
- Keeps SQLite publication isolated from ordinary editing.

**Weaknesses**

- Contradicts the direction of ADR-0019, ADR-0024, `packages/arqfs`, and the
  dedicated Worker architecture.
- Creates two serialisation paths for one logical project.
- Makes a published `.arq` file a projection rather than the live project
  container, increasing fidelity and migration risk.
- Requires every open to import into a different canonical store and every
  publication to export back out.
- Makes identity, revision, and recovery provenance harder to prove.

### Option C: SQLite and OPFS own the canonical working project; IndexedDB owns a bounded recovery and device-local support tier

Use the SQLite database in an ARQ-owned dedicated Worker as the canonical local
working project after a source has been safely staged. Keep IndexedDB only for
bounded responsibilities that do not constitute a second canonical project:

- pre-commit or not-yet-checkpointed typed operation journal entries;
- recovery session metadata and last-known-good pointers;
- source evidence references and staging provenance;
- device-local derived caches, indexes, thumbnails, and view preferences;
- resumable publication metadata that can be discarded after completion.

A journal entry is never displayed as a portable save. Accepted semantic
operations are applied transactionally to the SQLite working copy. The journal
exists to bridge interrupted application and checkpoint boundaries, not to
become an alternate project database.

**Strengths**

- Aligns with the dedicated Worker and native `.arq` direction while preserving
  tested IndexedDB recovery work during a controlled cutover.
- Keeps canonical and derived responsibilities explicit.
- Supports a staged implementation with replacement coverage before old journal
  paths are removed.
- Allows a clean portable publication from the working database after
  checkpoint, integrity, capability, and sidecar checks.
- Keeps UI/session and derived-cache data outside the project file by default.

**Weaknesses**

- Requires explicit ordering and idempotency between the IndexedDB journal and
  SQLite transactions.
- Recovery must prove that entries cannot replay twice or against the wrong
  base revision.
- Two storage technologies remain in the product, although with non-overlapping
  authority.
- Safari, quota, private browsing, and storage eviction behaviour remain
  platform risks that need physical and protected-environment evidence.

### Option D: SQLite owns canonical state and a SQLite operations table is the only journal; IndexedDB is derived cache and UI state only

This is the target simplification after Option C has proven the product
lifecycle. The operation log and canonical state share SQLite transactions.
IndexedDB retains only replaceable derived data and device preferences.

**Strengths**

- Clear steady-state authority and fewer crash-ordering edges.
- Atomic semantic state and operation-log commits.
- Simpler long-term recovery reasoning.

**Weaknesses**

- Not a safe first cut from the current implementation.
- Requires replacing the current refresh recovery path before the protected
  workflow can rely on it.
- Needs browser evidence for Worker and OPFS durability across failure modes.

## Recommended choice

**Recommend Option C as the migration architecture, with Option D as a possible
later simplification after replacement evidence exists.**

This is a recommendation only. The ADR remains Proposed until the named owners
accept it.

The recommendation preserves current tested recovery code while giving the
SQLite Worker unambiguous authority over the canonical working project. It also
allows the product lifecycle to be implemented in protected stages instead of
removing working recovery code before its replacement is proven.

Option A is weaker now because it creates a large one-step cutover. Option B is
weaker because it makes the intended `.arq` database an export projection and
keeps IndexedDB as a second canonical project. Option D is a sensible steady
state but is too abrupt as the first migration step.

## Proposed responsibility map

| Responsibility            | Proposed authority                                                            | Required rule                                                           |
| ------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| User-selected source file | External immutable source evidence                                            | Never mutated during open or migration                                  |
| Source evidence           | IndexedDB metadata plus source fingerprint                                    | Records selection, completeness, WAL warning, and provenance            |
| Staged copy               | OPFS staging area owned by the Worker lifecycle                               | Created before migration or write-capable open                          |
| Canonical working copy    | SQLite database in OPFS through the ARQ Worker                                | One active writer, typed RPC, transactional operations                  |
| Canonical semantic state  | Semantic tables and stable identifiers in the working database                | Renderer and caches cannot mutate it directly                           |
| Accepted local operation  | SQLite transaction after deterministic validation                             | Rejection leaves previous canonical state unchanged                     |
| Pending recovery journal  | Bounded IndexedDB typed-operation entries during migration phase              | Project ID, base revision, operation ID, checksum, idempotent replay    |
| Durable operation history | SQLite operations table or revision log                                       | Written in the same transaction as canonical effects where supported    |
| Snapshot                  | Verified last-known-good SQLite checkpoint or clean copy                      | Named revision and integrity result                                     |
| Recovery metadata         | IndexedDB session record referencing verified project and snapshot IDs        | Never stores an unlabelled second project truth                         |
| Derived cache             | IndexedDB or other device-local cache                                         | Replaceable, versioned, safely invalidated                              |
| Migration                 | Copy-on-write Worker process against staged copy                              | Verify reopen and integrity before activation; quarantine failure       |
| Workspace activation      | Application state after Worker open, integrity, hydration, and view readiness | No early “open” state                                                   |
| Portable publication      | Clean single-file SQLite copy produced by Worker publication path             | Checkpointed, no WAL/SHM dependency, integrity verified, atomic handoff |
| Archive interchange       | Existing versioned zip archive where still supported                          | Explicitly labelled interchange, not the live working database          |
| Sync                      | Typed operations and content-addressed resources only                         | Never raw SQLite pages or live WAL files                                |
| Remote acknowledgement    | Sync transport receipt and accepted server revision                           | Only this may be described as synced                                    |

## Project-open state machine

Implementation after acceptance must use an explicit user-reachable state
machine:

```text
idle
  -> source-selected
  -> preflighted
  -> staged
  -> migration-verified
  -> worker-open
  -> hydrated
  -> workspace-active
```

Every transition needs a named failure, cancellation, and recovery state. The
interface must not describe a project as open before Worker open, integrity,
semantic hydration, and workspace activation all succeed.

## Migration ownership

- Migrations run only against a staged copy or an already-owned working copy.
- The selected source file remains unchanged and available as evidence.
- The migration result is reopened and integrity-checked before activation.
- A failed or partially migrated copy is quarantined with diagnostics.
- The last known good working project remains available until the new copy is
  verified.
- Migration records include source version, target version, schema capability,
  result revision, tool revision, and failure reason.

## Recovery ownership

- Recovery starts from an identified project, base revision, and verified last
  known good snapshot.
- Journal entries are typed, ordered, checksummed, and idempotent.
- Recovery refuses entries for another project or incompatible base revision.
- Replayed entries pass the same deterministic validation and transactional
  commit path as ordinary operations.
- A rejected recovery entry leaves the previous canonical state unchanged and
  produces a repairable error.
- Recovery completion records the resulting revision and clears only entries
  proven incorporated.

## Publication ownership

- Publication is a distinct action from journal durability or local checkpoint.
- The Worker checkpoints or otherwise produces a clean copy that does not
  require WAL or SHM sidecars.
- The clean copy passes application ID, version, capability, integrity,
  semantic-hash, and reopen checks before user handoff.
- Interrupted publication leaves the prior portable file and working copy
  unchanged.
- The user-selected external destination is written through a temporary or
  provider-supported atomic replacement where available. Where atomic
  replacement is unavailable, the UI must state the limitation and preserve a
  recoverable local copy.

## Security and privacy impact

- Worker RPC remains typed and capability-gated. No arbitrary SQL or arbitrary
  file-system path is exposed to UI, MCP, or AI clients.
- Project IDs and lock names are scoped per project to prevent cross-project
  blocking and recovery.
- Source fingerprints, journal records, and recovery metadata must not contain
  unnecessary document content.
- Derived caches inherit the same local data classification as the project but
  remain deletable and non-authoritative.
- Sync, if later enabled, transmits typed operations and approved resources,
  not SQLite pages, WAL files, browser database records, or unrestricted
  queries.
- Privacy wording must distinguish observed same-origin runtime behaviour from
  absolute guarantees across future hosted features.

## Data-loss risks and controls

| Risk                                    | Control required before acceptance evidence can pass                      |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Missing WAL sidecar on selected project | Preflight completeness warning and source preservation                    |
| Partial migration                       | Staged copy, quarantine, reopen, integrity, rollback                      |
| Worker termination during write         | Transaction rollback plus recoverable journal entry                       |
| Journal replay twice                    | Stable operation ID and applied-operation check                           |
| Journal replay on wrong project         | Project ID, base revision, semantic hash, refusal                         |
| Quota exhaustion                        | Preflight capacity estimate, explicit failure, last known good retained   |
| Browser refresh                         | Recovery session record and deterministic reactivation path               |
| Storage eviction                        | Capability warning, portable publication guidance, backup policy decision |
| Interrupted publication                 | Temporary output, verified copy, no replacement before success            |
| Derived cache drift                     | Revision binding and invalidation, never canonical mutation               |
| Multi-tab writer conflict               | Per-project lock and BroadcastChannel coordination                        |
| Cloud-drive corruption                  | No live database or WAL over consumer cloud-drive working paths           |

## Browser and platform limitations

Acceptance requires evidence for the supported browser matrix. In particular:

- OPFS availability, quota, persistence grants, and eviction behaviour differ
  by browser and mode.
- File System Access API support and atomic replacement behaviour are not
  uniform.
- Private browsing and managed-device policies can disable or shorten storage
  lifetime.
- Safari and iPad browser memory and Worker termination behaviour require
  physical-device evidence.
- Firefox support cannot be claimed from Chromium-only tests.
- Native file-provider behaviour cannot be inferred from browser file-picker
  tests.

Unsupported environments must enter explicit read-only, export-only, or
unsupported-capability states. They must not silently fall back to a second
canonical store.

## Compatibility

- Existing IndexedDB journal records remain readable during the migration
  window and can be converted only through a versioned, tested path.
- Existing zip archives remain explicit interchange containers while their
  support contract remains active.
- Existing SQLite schema versions use the current capability and migration
  registries.
- Older readers must refuse unknown required capabilities without mutating the
  project.
- Publication must produce a file that can be reopened by the exact tested
  reader revision before it is handed off as complete.

## Performance

Measure rather than assume:

- selected-file preflight time;
- staging throughput;
- Worker startup and database-open time;
- semantic hydration time to first useful view;
- operation commit latency;
- journal append and recovery replay latency;
- checkpoint and publication time;
- memory during migration and publication;
- refresh recovery time;
- large-project behaviour on minimum supported hardware.

Performance work must not bypass integrity, transaction, migration, or recovery
checks. A faster path that weakens project-data safety is rejected.

## Implementation sequence after acceptance

1. Define types and invariants for the state machine and responsibility map.
2. Add a Worker-backed staged-open service without activating the workspace.
3. Prove valid, unsupported, truncated, corrupt, WAL-incomplete, and
   cancellation paths.
4. Add copy-on-write migration and quarantine proof.
5. Add semantic hydration and delay workspace activation until it succeeds.
6. Bind the existing IndexedDB recovery journal to stable project and base
   revision identity.
7. Add close, refresh, reopen, Worker termination, quota, and recovery tests.
8. Add clean portable publication and interrupted-publication tests.
9. Run the protected browser Worker and OPFS end-to-end test at the exact
   revision.
10. Only then retire or narrow legacy IndexedDB project-persistence modules,
    with replacement coverage and a reversible migration.

## Validation and evidence plan

Acceptance of the ADR does not verify implementation. The implementation needs:

- unit tests for state transitions and invalid transition refusal;
- transaction tests proving rejected operations do not mutate canonical state;
- migration tests with reopen, integrity, quarantine, and rollback;
- journal idempotency and wrong-project refusal tests;
- real browser Worker and OPFS end-to-end tests;
- refresh, Worker termination, quota, permission, and cancellation tests;
- clean publication checks that prove no WAL or SHM dependency;
- reopen tests at the exact published revision;
- security tests for typed RPC, cross-project isolation, and no arbitrary SQL;
- network observation for any hosted path;
- performance evidence on the approved browser and hardware matrix;
- protected L4 approval before release claims change.

## Rollback

Before product activation, rollback is removal of the new open pipeline while
preserving source files, staged copies, and existing journal records.

After activation, rollback must:

1. stop new writes;
2. preserve the current working copy and journal evidence;
3. publish or retain a verified last-known-good portable copy;
4. revert the application to the last compatible reader;
5. migrate records only through a versioned reverse or forward recovery path;
6. never reset, delete, or rewrite the selected source file;
7. record the affected project IDs, revisions, cause, and recovery outcome.

A code revert without project-data recovery is not an adequate rollback.

## Consequences

If accepted:

- the SQLite Worker becomes the authority for canonical local project state;
- IndexedDB remains active but bounded to recovery bridging, provenance,
  replaceable derived data, and device-local state during migration;
- no UI may call a journal append a portable save;
- no sync implementation may move raw SQLite pages or WAL files;
- the project-open lifecycle can proceed through the protected sequence;
- removal of existing journal modules requires replacement evidence, not a
  documentation-only status change.

If rejected, the owner must choose another option and update ADR-0019, ADR-0022,
ADR-0024, the decision register, the source registry, project-open plans, and
public state language in the same governed change.

## Related evidence and records

- ADR-0006: Snapshots and local journal
- ADR-0010: ARQ archive
- ADR-0019: Native `.arq` SQLite file format
- ADR-0021: Local-first replica sync
- ADR-0022: Canonical and derived data separation
- ADR-0023: Progressive project opening
- ADR-0024: SQLite WebAssembly Worker and OPFS strategy
- `packages/arqfs`
- `packages/local-storage`
- `workers/arqfs-worker`
- `apps/web/src/canvas/plan-journal.ts`
- `docs/architecture/PERSISTENCE-AND-RECOVERY.md`
- `remaining/DECISIONS-REQUIRING-EVIDENCE.csv`
- `engineering/00-audit/CURRENT_TRUTH_CONFLICTS.md`
- open draft PR #280, stale and conflicting

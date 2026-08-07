---
source_id: ARQ-OS3-INVARIANT-BRIDGE
source_type: architecture-bridge
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ architecture owner
repository_authority: .zeus/INVARIANTS.md and accepted ADRs
---

# Architecture, file state, and invariant bridge

## No copied invariant register

The repository's `.zeus/INVARIANTS.md` is the single invariant register. This Project references it and identifies task-relevant consequences. It must not maintain a parallel copy that can drift.

## Protected concepts

Any ARQ task that touches the following must load the relevant repository source and use deep evidence:

- semantic model authority;
- units, tolerances, topology, and geometry identity;
- typed operations, validation, undo, and provenance;
- `.arq` schema, application ID, migrations, future-version handling, recovery, and repair;
- working copies, browser journals, snapshots, portable publication, sync, and read-only modes;
- renderer projections, indexes, thumbnails, derived caches, and invalidation;
- import and export fidelity;
- permissions, grants, AI apply paths, and project-data boundaries.

## State vocabulary

Use distinct state objects for:

| State | Meaning |
|---|---|
| Canonical model | Accepted semantic project truth |
| Transient preview | Reversible interaction state not yet committed |
| Browser journal | Device-local operation history for the current browser experience |
| Working copy | Mutable local database or project representation used for active editing |
| Portable `.arq` | Published, versioned project file intended for transfer and reopen |
| Recovery snapshot | Point-in-time recovery material with explicit scope |
| Derived cache | Disposable projection regenerated from canonical data |
| Sync replica | Governed remote or peer state under a defined protocol |
| Exported artifact | Derived external deliverable with fidelity and revision metadata |

Never collapse these into one generic `saved` or `synced` status.

## File safety bridge

Before file or migration work:

1. Resolve accepted ADRs and current schema code.
2. Preserve source bytes and provenance.
3. Preflight identity and completeness before opening.
4. Use copy-on-write migration.
5. Verify integrity and reopen before promotion.
6. Preserve or quarantine failed migration evidence.
7. Publish atomically.
8. Ensure a clean portable file has no required WAL or SHM sidecars.
9. Exercise interruption, corruption, future-version, permission, quota, cancellation, and recovery paths.
10. Record exact fixtures and hashes.

## Model and renderer bridge

Renderer objects, meshes, hit regions, canvas primitives, projections, thumbnails, and indexes are derived. Selection may be coordinated across views, but display objects cannot become canonical project truth. Invalid or incomplete input must not partially commit semantic operations.

## AI bridge

AI clients may propose typed operations against a pinned project revision and scoped grant. Deterministic project validation and permissions decide whether a proposal can proceed. Human approval is required for consequential edits. The commit path must use normal operations and grouped undo.

## Architecture change rule

A Project request cannot accept a new architecture by phrasing it as an implementation task. When work conflicts with an accepted ADR or introduces a new canonical state, file format, sync method, renderer authority, platform boundary, or professional claim, create or update the repository ADR before implementation.

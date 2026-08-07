# Current ARQ state observed on August 6, 2026

## Sources and authority

The strongest available repository evidence in this package is the public repository HTML plus the August 4 Operator OS snapshot. This is weaker than an immutable checkout. Current code, tests, CI, schemas, migrations, and accepted ADRs at immutable HEAD remain required before implementation.

## Publicly observable state

The repository is public and displays the branch `claude/arq-cad-platform-research-ba8rav`. Its README identifies ARQ as pre-release and says the protected residential workflow is incomplete. It describes `.arq` as a native SQLite application database with an OPFS working copy and explicit writer ownership. It also states that semantic entities and typed operations are canonical, while meshes, indexes, thumbnails, and projections are derived.

The public `STATUS.md`, last updated July 27, says:

- `packages/arqfs` has schema v1 and v2, capability-gated open, byte preflight, copy-on-write migration, reopen and integrity verification, recovery reports, and fuzz tests.
- The library is not connected to a product open-project pipeline.
- The shell runs on demo project context.
- Plan editing and an IndexedDB journal are real.
- Import and export adapters are tested libraries but not end to end in the product.
- The API app is a stub and sync has no backend.

## Conflicts requiring repository resolution

1. The same status page says a 3D view renders walls, then says the 3D stack has zero consumers and no 3D surface. Code and tests must resolve this.
2. Accepted ADR direction is described as SQLite-WASM/OPFS, while the product uses a tested Dexie/IndexedDB journal. An explicit ADR must define whether one is temporary, complementary, or superseded.
3. The status page is older than this package. It cannot establish current HEAD truth.
4. The Operator OS snapshot observed a specific August 4 commit and draft PR. That SHA is historical evidence only until rechecked.

## Current product boundary

Architecture remains the protected first domain. Future product, mechanical, vehicle, aerospace, and urban packs must not delay the complete residential authoring, 3D, sheet, PDF, close, recover, reopen workflow.

## Required repository facts before code changes

- Repository URL and access method.
- Default and active branch.
- Immutable HEAD SHA.
- Clean or dirty working tree.
- Open PRs affecting the same files.
- `CLAUDE.md`.
- `.zeus/FAST-KERNEL.md`.
- `.zeus/INVARIANTS.md`.
- Current `.arq` application ID and schema versions.
- Migration graph and recovery fixtures.
- Current OPFS and IndexedDB ownership rules.
- Current CI and required checks.
- Requested delivery stop.

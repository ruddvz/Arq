# Truth boundary and non-claims

## Authority order

Current implementation truth belongs to revision-bound repository code, schemas, migrations, tests, CI, deployment artifacts, and directly observed runtime. Accepted ADRs and contracts govern intended architecture. This package is Class E proposal and research material.

## Current repository status

The Project snapshot observed repository `ruddvz/Arq`, default branch `claude/arq-cad-platform-research-ba8rav`, and commit `7f15889ea66b672bd918a8b7ba61a904f6b4da3d` on 4 August 2026. The connected GitHub fetch returned `404` on 5 August 2026. The earlier snapshot is still useful historical evidence but is not a substitute for current immutable HEAD inspection.

## Production values intentionally not allocated

- SQLite `application_id`.
- Schema version and migration numbers.
- Canonical codec identifiers.
- Capability namespace ownership.
- Geometry-kernel codec IDs.
- Production object type IDs.
- Accepted error code ranges.
- File extension registration or MIME type.
- Cryptographic signing policy.

The reference implementation uses an explicitly demo-only application identifier and namespace.

## Non-claims

This package does not claim that `.arq` is currently:

- lossless with DWG, RVT, IFC, STEP, Parasolid, JT, USD, glTF, CityGML, or 3D Tiles;
- deterministic across operating systems or geometry kernels;
- safe against all hostile SQLite or geometry inputs;
- suitable for aircraft certification, vehicle homologation, structural approval, or manufacturing release;
- synchronised, collaborative, or cloud-backed in production;
- able to design a futuristic city, car, or aircraft today;
- accessible, secure, performant, or released without scoped evidence.

## Required repository reconciliation

ZEUS must resolve the actual repository, immutable HEAD, working tree, open PRs, current `.arq` implementation, accepted ADRs, `CLAUDE.md`, `.zeus/FAST-KERNEL.md`, `.zeus/INVARIANTS.md`, schema allocations, migrations, tests, and delivery stop before implementation.

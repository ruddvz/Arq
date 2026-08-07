# Large-scene and project federation

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

City, campus, aircraft-programme, and vehicle-platform projects require composition, selective loading, spatial indexing, and revision pinning rather than one giant continuously hydrated file.

## Normative requirements

- A federated reference MUST identify child project, immutable revision, expected publication or content hash, transform, coordinate frame, required capabilities, load policy, access policy, and fallback representation.
- A root project MUST remain openable when optional child projects are unavailable, with explicit missing-reference states.
- Release baselines MUST resolve every required child and asset to immutable revisions.
- LOD records MUST distinguish streaming LOD, geometric approximation, semantic detail, design maturity, and analysis resolution.
- Edits to a child project MUST occur through that child’s authority and produce a new pinned revision in the parent through an accepted operation.

## Required invariants

- Reference cycle.
- Coordinate datum mismatch.
- Floating child changes.
- Missing permissions.
- LOD displays obsolete geometry.
- Asset hash mismatch.
- City-scale index exhaustion.

## Known failure modes

- Parent files do not rewrite child canonical state.
- Transforms are explicit and unit-aware.
- Missing optional references do not become deleted objects.
- Derived tiles remain traceable to child revisions.

## Required evidence

- Federation graph fixtures.
- Missing child tests.
- Coordinate-frame tests.
- Selective-loading performance benchmarks.
- Release-baseline closure checks.

## Implementation guidance

- Borrow composition concepts from OpenUSD without copying its scene semantics wholesale.
- Borrow streaming hierarchy concepts from 3D Tiles.
- Start with pinned architecture project references before city-scale authoring.

## Open decisions

- Maximum federation depth.
- Reference resolver and offline cache policy.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

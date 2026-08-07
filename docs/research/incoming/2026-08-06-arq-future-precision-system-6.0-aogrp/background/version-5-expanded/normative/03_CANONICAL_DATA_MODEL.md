# Canonical data model

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

The canonical model stores design meaning and accepted change independently from any one geometry kernel or renderer. It is component-oriented, typed, versioned, and capability-aware.

## Normative requirements

- Every canonical entity MUST have stable project-scoped identity and registered type identity.
- Components MUST be encoded using registered schemas and deterministic canonical payloads.
- Relationships MUST be typed records with stable identity, source, target, role, ordering semantics where applicable, and validity rules.
- Canonical objects MUST NOT depend on SQLite row order, auto-increment values, memory pointers, render handles, or kernel indexes.
- Derived caches MUST declare source revision, dependency digest, generator, version, and disposable status.
- Deleting a canonical object MUST use an accepted operation and MUST resolve or explicitly invalidate inbound references.

## Required invariants

- Entity-component blobs without schemas.
- Cycles where forbidden by domain rules.
- Duplicate relationship identities.
- Orphaned components.
- Unknown type marked required without reader support.
- Kernel payload treated as the only geometry source.

## Known failure modes

- One accepted revision root represents one complete canonical semantic state.
- Derived data cannot silently become canonical because regeneration failed.
- Every type has one registered owner and compatibility policy.

## Required evidence

- Canonical-state reconstruction from operation history and snapshots.
- Schema validation for every component.
- Graph invariant tests.
- Independent reader comparison of revision roots.

## Implementation guidance

- Use narrow core tables for identity, components, relationships, operations, revisions, assets, capabilities, and evidence.
- Keep domain tables optional unless repository performance evidence requires them.
- Index query paths but exclude indexes from canonical identity.

## Open decisions

- Whether canonical state is fully reconstructable from operations or requires authoritative snapshots.
- How type registry governance is published.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

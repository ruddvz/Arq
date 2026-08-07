# Capabilities, extensions, and domain packs

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

A single schema number cannot express every future architecture, product, vehicle, aerospace, urban, simulation, and collaboration capability. A governed registry allows evolution without a generic untyped blob system.

## Normative requirements

- Every file MUST declare required and optional capabilities with namespace, version range, owner, and preservation policy.
- Readers MUST refuse editable mode when a required capability is unsupported.
- Readers MAY open read-only-preserving mode when unknown optional capability bytes can be preserved exactly and no canonical interpretation is required.
- Extensions MUST declare schemas, operation types, canonical hash contribution, dependencies, limits, migrations, diagnostics, and uninstall behaviour.
- Domain packs MUST use registered semantic types and may not bypass core operations, revisions, permissions, or publication validation.
- Capability identifiers MUST not be allocated from this package without repository governance.

## Required invariants

- Capability dependency cycle.
- Uninstalled extension owns required data.
- Extension migration unavailable.
- Same namespace claimed by two packages.
- Optional bytes not preserved after write.

## Known failure modes

- Unknown required capability is never silently ignored.
- Extension data cannot execute merely because a file contains it.
- Namespace ownership is unique and auditable.

## Required evidence

- Unknown-capability fixtures.
- Roundtrip preservation tests.
- Extension uninstall and quarantine tests.
- Registry collision tests.
- Migration-chain tests.

## Implementation guidance

- Keep the stable core small.
- Separate data capabilities from executable plugin permissions.
- Require signed and reviewed extension distribution only after security architecture is accepted.

## Open decisions

- Registry authority and publication process.
- Whether third-party executable extensions are allowed in browser builds.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

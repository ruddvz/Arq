# File identity and preflight header

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

The file identity layer allows a bounded reader to decide whether a file is a candidate `.arq`, which profile it requires, and whether deeper parsing is safe. Production numeric values remain unallocated until repository reconciliation.

## Normative requirements

- A production `.arq` MUST have a repository-allocated SQLite application ID and schema version.
- The database MUST contain exactly one project identity record with stable project UUID, created format version, current format version, minimum reader version, minimum writer version, and publication ID.
- Required capabilities MUST be readable before large assets, geometry payloads, or external references are hydrated.
- Preflight MUST run read-only with extension loading disabled and bounded SQLite limits.
- The demo application ID `0x41525134` used in this package MUST NOT be copied into production.
- File name extension and MIME hints MUST NOT override magic, SQLite identity, or internal preflight results.

## Required invariants

- Extension-based content sniffing.
- Multiple project rows.
- Negative or unsupported schema versions.
- Header identity matching while internal identity conflicts.
- Opening a future required capability in write mode.

## Known failure modes

- One portable publication represents one project identity and one published revision root.
- Publication identity is different from project identity and revision identity.
- A copied file may have identical bytes and publication ID until explicitly republished.

## Required evidence

- Healthy, wrong-application-ID, missing-project-row, duplicate-project-row, and unsupported-capability fixtures.
- Fresh-process preflight results.
- Exact error code and user-visible recovery action.

## Implementation guidance

- Use a small set of indexed preflight tables.
- Do not parse arbitrary extension blobs during preflight.
- Return a structured verdict: editable, read-only-preserving, reference-only, quarantine, corrupt, or unsupported.

## Open decisions

- Production application ID.
- Whether publication IDs use UUIDv7 or repository-standard identifiers.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

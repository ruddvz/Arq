# Container and portable publication

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

The candidate container is SQLite, but the portable `.arq` file is a closed publication artifact, not the live browser database copied opportunistically. This contract governs save, Save As, checkpoint, compaction, and publication.

## Normative requirements

- The working database MAY use WAL or another journal mode, but a portable publication MUST be a single closed database with no required sidecars.
- Publication MUST create a separate candidate using a consistent backup or equivalent transactional snapshot.
- The publisher MUST set portable journal settings, close the candidate, fsync file and containing directory where supported, and reopen through a fresh read-only connection.
- The fresh reader MUST verify SQLite integrity, identity, schema, capabilities, canonical revision root, asset hashes, required references, and publication evidence.
- Only a validated candidate MAY be atomically promoted to the requested destination.
- Failure MUST leave the previous source and previous valid destination unchanged.
- The published file MUST record publisher build, source revision, candidate checks, observed limitations, and timestamp, without making volatile metadata part of revision identity.

## Required invariants

- Copying only the main WAL database.
- Writing directly over the source.
- Power loss during rename.
- Successful SQLite integrity with failed semantic root.
- Assets referenced but absent.
- Multiple browser tabs publishing competing states.

## State machine

1. Acquire publication intent and destination.
2. Freeze or snapshot one accepted source revision.
3. Create isolated candidate.
4. Apply portable settings and optional compaction.
5. Close and flush candidate.
6. Fresh-reader validation.
7. Atomic promotion.
8. Record success or preserve failure evidence.

## Known failure modes

- Invalid operations leave previous canonical state unchanged.
- Portable publication never depends on WAL or SHM sidecars.
- Publication is not verified until a fresh reader reopens the exact candidate bytes.

## Required evidence

- Crash injection before and after each publication phase.
- Byte hash of source, candidate, promoted file, and retained backup.
- Fresh-process reopen and root comparison.
- Platform tests for Windows, macOS, Linux, iOS Safari, and supported Chromium browsers.

## Implementation guidance

- Keep publication code separate from editing transactions.
- Use a publication lock scoped to project and destination.
- Expose progress by phase, not fake percentage.
- Retain recoverable candidates only under a bounded retention policy.

## Open decisions

- Required durability level on mobile browsers.
- Whether portable publications are vacuumed or preserve page layout for forensic recovery.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

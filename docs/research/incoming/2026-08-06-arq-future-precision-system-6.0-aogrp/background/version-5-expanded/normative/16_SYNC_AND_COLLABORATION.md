# Sync and collaboration

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Future collaboration should replicate semantic revisions and operations, not database pages. Local portable project ownership remains compatible with optional cloud services.

## Normative requirements

- Every synchronised object MUST be scoped to a project and immutable revision lineage.
- Sync transport MUST authenticate project access, enforce least privilege, bind uploads to expected parent revision, and reject unknown history forks unless explicitly imported as branches.
- Offline edits MUST create local revisions that can be compared and merged after reconnect.
- Servers MUST NOT rewrite accepted client history silently. Server-generated maintenance actions require explicit typed records.
- Presence, cursors, comments, and notifications are non-canonical unless a domain contract promotes them.
- Encryption, retention, deletion, region, backup, and account ownership policies must be specified before production sync claims.

## Required invariants

- Duplicate upload.
- Concurrent parent.
- Offline branch.
- Deleted account.
- Stale floating reference.
- Partial asset upload.
- Server rollback.
- Malicious collaborator.

## Known failure modes

- Canonical merge remains semantic.
- Portable files remain usable without the collaboration service.
- Network order does not define design truth.

## Required evidence

- Network partition tests.
- Idempotent upload tests.
- Branch and merge fixtures.
- Permission revocation tests.
- Disaster recovery drills.

## Implementation guidance

- Defer real-time geometry co-editing.
- Start with immutable revision push/pull and explicit branch merge.
- Use content-addressed assets and resumable upload.

## Open decisions

- Cloud provider and data model.
- End-to-end encryption requirements.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

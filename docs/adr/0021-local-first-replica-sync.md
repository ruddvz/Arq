# ADR-0021: Local-first replica and operation sync

**Status:** Proposed
**Date:** 2026-07-22

## Decision

Every device edits a local project replica. Sync typed operations and
content-addressed resources. Never sync raw SQLite pages.

## Consequences

- Instant offline commits
- Safer cloud-provider integration
- Explicit conflict model required
- Server sequence and idempotency required

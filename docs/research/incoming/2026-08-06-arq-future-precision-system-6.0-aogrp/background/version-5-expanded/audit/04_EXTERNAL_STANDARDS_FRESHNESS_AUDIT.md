# External standards freshness audit

The package date and the standard date are separate. A specification from 2025 can remain current in 2026, but MCP did not. Version 5 records both the observed date and the exact edition.

## Rules

1. Use official specifications, release registries, or vendor documentation.
2. Record the exact edition, release date, and retrieval date.
3. Distinguish official stable, release candidate, draft, living clarification, and deprecated.
4. Do not call a draft “current”.
5. Do not silently upgrade a compatibility target.
6. Pin implementation dependencies independently of the conceptual standard.
7. Re-run the freshness audit before an ADR or release.

The machine-readable snapshot is in `current-state/STANDARDS_SNAPSHOT.json`.

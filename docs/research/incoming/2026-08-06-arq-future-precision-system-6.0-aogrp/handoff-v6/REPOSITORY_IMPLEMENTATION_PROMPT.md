# Repository implementation prompt

Use this package as Class E research, not repository authority.

1. Resolve the repository, branch, immutable HEAD, working tree, open PR overlap, and requested delivery stop.
2. Read `CLAUDE.md`, then `.zeus/FAST-KERNEL.md`, then task-relevant `.zeus/INVARIANTS.md` and accepted ADRs.
3. Inspect current project-format code, SQLite application ID, schema versions, migrations, OPFS and IndexedDB ownership, fixtures, benchmarks, and product-open wiring.
4. Produce an evidence-bound comparison of three options:
   - retain SQLite as both working and portable format;
   - hybrid: AOGRP canonical pack plus SQLite working materialisation;
   - AOGRP as optional sync or interchange representation only.
5. Do not accept the custom format because it appears innovative. Require measurable benefits in deterministic identity, append recovery, partial loading, sync, independent reading, or large-project behaviour.
6. If an experiment is justified, implement the smallest vertical slice behind a non-production feature flag. Use package-only identifiers or repository-allocated experimental identifiers.
7. Convert one source fixture read-only. Preserve source bytes. Compare semantic IDs, revisions, operations, views, sheets, and assets.
8. Build a second reader from the byte specification. Add golden vectors, corruption, crash injection, repack, capability, and migration tests.
9. Stop at the authorised delivery boundary. Do not create branches, commits, PRs, deployments, or settings changes without explicit scope.
10. Report Completed, Verified, Inferred, Assumed, and Blocked with exact SHA, commands, tests, artefacts, failures, and rollback.

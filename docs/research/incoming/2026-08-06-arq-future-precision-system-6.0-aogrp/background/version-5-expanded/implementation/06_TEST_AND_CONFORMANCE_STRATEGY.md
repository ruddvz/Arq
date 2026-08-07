# Test and conformance strategy

## Layers

1. Schema and registry validation.
2. Canonical encoding golden vectors.
3. Exact quantity and unit property tests.
4. Operation atomicity and invariant tests.
5. Revision reconstruction and root tests.
6. Publication crash and recovery tests.
7. Migration and backward-read corpus.
8. Geometry-kernel golden fixtures.
9. Persistent topology naming fixtures.
10. Interchange edition and profile corpora.
11. MCP grant, approval, replay, and stale-state tests.
12. UI state, accessibility, and browser workflow tests.
13. Fuzzing and resource-exhaustion tests.
14. Independent reader and writer conformance.

## Golden fixture policy

A fixture includes source bytes, expected preflight verdict, expected diagnostics, expected canonical root where applicable, expected publication behaviour, and licence or redistribution status. Fixture updates require a reviewed explanation and cannot be accepted solely because implementation output changed.

## Evidence policy

Test output must name implementation revision, test-suite revision, platform, runtime, SQLite version, kernel version, fixture digest, command, exit code, and limitations. Cached results are insufficient for migration, recovery, file-format, security, and release claims.

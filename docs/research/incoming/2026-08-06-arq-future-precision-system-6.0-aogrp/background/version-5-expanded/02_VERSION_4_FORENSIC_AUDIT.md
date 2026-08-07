# Version 4.0 forensic audit

## Verified archive facts

- Files: 134
- Markdown files: 73
- JSON Schemas: 16
- `.arq` fixtures: 7
- Python bytecode files incorrectly shipped: 12
- Files containing the superseded MCP date `2025-11-25`: 2
- Files containing a fixed midnight generation timestamp: 1
- Prior archive SHA-256: `716b5ff6fcd84dc49da460f550af82131dbe66123153cf149d759dbf058492c0`

## What was good

Version 4.0 materially improved the evidence quality of the series. It contained actual schemas, SQL, reference code, fixtures, tests, a package inventory, a manifest, research, normative contracts, UX flows, and a ZEUS handoff. It also disclosed that repository HEAD had not been inspected.

## Accuracy defects

### Superseded MCP baseline

The package described the 2025-11-25 revision as current. MCP 2026-07-28 was released before Version 4.0 was delivered. The new revision changes transport and lifecycle assumptions: requests are self-describing, protocol sessions and the initialize handshake are removed, discovery is optional, routing headers are mandatory for Streamable HTTP, MRTR replaces several server-initiated patterns, and Tasks are an extension.

### Stale repository state

Version 4.0 relied mainly on the August 4 Operator OS snapshot and a failed GitHub connector call. The public repository page was available and exposes a newer public README and `STATUS.md`. Those sources are still insufficient for immutable implementation truth, but they should have been included.

### Generated artefacts in the deliverable

The archive included `__pycache__` and `.pyc` files. These are environment-specific build artefacts, not source or evidence. They create noise, make inventory less stable, and can leak interpreter details.

### Demonstrator identifier safeguards

The package said its application ID was package-only, but the guard was documentary. Version 5.0 adds explicit text, renamed identifiers, and tests. Production allocation remains blocked.

### Test environment mismatch

The package-local Python runtime embeds SQLite 3.46.1, while current upstream SQLite is 3.53.4. This does not invalidate the tests, but it limits their evidence. Browser SQLite-WASM and current upstream behaviour remain unverified.

## Design gaps carried forward

- No byte-level normative SQLite header contract tied to current repository allocation.
- No accepted choice for canonical deterministic binary encoding.
- No independent second reader or writer.
- No real browser OPFS implementation or crash-injection harness.
- No geometry kernel payload compatibility tests.
- No domain-pack ABI implementation.
- No real IFC, STEP, DWG, RVT, USD, or CityGML roundtrip corpus.
- No multi-gigabyte city or product assembly benchmark.
- No production MCP server using the current SDK and protocol.
- No repository implementation or deployment evidence.

Version 5.0 does not mark these as complete. It gives each a closure packet.

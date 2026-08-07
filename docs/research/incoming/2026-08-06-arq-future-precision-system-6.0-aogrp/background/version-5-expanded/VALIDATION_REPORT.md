# Validation report

**Generated:** August 6, 2026  
**State:** Verified for package-local artefacts only

## Executed checks

- Unit tests passed: 32
- JSON Schemas meta-validated: 26
- Candidate SQL parse: passed
- `.arq` fixture verdicts represented: 11
- MCP standards snapshot: 2026-07-28
- Python runtime: `3.13.5 (main, May  5 2026, 21:05:52) [GCC 14.2.0]`
- SQLite runtime used by package tests: `3.46.1`

## Final package inventory

- Total files, including inventory and manifest: 246
- Markdown documents: 166
- Markdown words: approximately 38,665
- JSON files, including inventory: 35
- JSON Schemas: 26
- `.arq` fixtures: 11
- Python source files: 22

## Verified package behaviours

- Deterministic JSON ordering and floating-point rejection in the demonstrator.
- Exact decimal quantity normalisation.
- Domain-separated hashes.
- Candidate `.arq` creation and deep validation.
- Bounded SQLite header inspection.
- Rejection of non-SQLite, truncated, wrong-ID, missing-table, foreign-key, missing-asset, and semantic-root fixtures.
- Preserving read-only verdict for an unknown required capability.
- Editable demo verdict with an unknown optional capability.
- Copy-on-write publication, fresh reopen, semantic-root comparison, and injected-failure preservation.
- Atomic typed operation failure leaves the prior state unchanged.
- Simplified three-way merge detects modify and delete conflicts.
- Proposal scope, stale-base, exact-digest approval, mutation, and replay checks.
- MCP 2026-07-28 request version, routing-header, client-metadata, and tool-name consistency checks.
- Schema Draft 2020-12 meta-validation.
- Candidate SQL parsing.

## Evidence limits

- Package tests use SQLite 3.46.1; current upstream SQLite is 3.53.4. Browser SQLite-WASM and OPFS remain unverified.
- The deterministic encoding demonstration uses JSON, not production deterministic CBOR.
- The MCP code is a boundary demonstrator, not a full official SDK implementation or conformance result.
- Current immutable ARQ repository HEAD, repository tests, CI, production schemas, migrations, browser runtime, and deployment were not inspected.
- No geometry kernel, IFC, STEP, DWG, RVT, USD, glTF, CityGML, 3D Tiles, vehicle, aircraft, or city workflow is implemented by this package.

## Evidence state

**Completed:** Version 4 audit, current standards snapshot, current public repository observation, architecture, normative contracts, MCP migration, UX, closure packets, schemas, SQL, reference code, fixtures, tests, and repository handoff.

**Verified:** Package-local inventory, hashes, schemas, SQL parse, fixtures, and test execution after final manifest validation.

**Inferred:** The proposed layers can extend the current semantic and local-first ARQ direction if reconciled at current HEAD.

**Assumed:** Architecture remains the protected first production domain.

**Blocked:** Immutable repository reconciliation, storage authority ADR, production identifiers, deterministic binary codec, current browser SQLite-WASM, kernel choice, persistent naming, real interchange conformance, production MCP integration, security review, and release evidence.

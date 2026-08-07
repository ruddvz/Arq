# Blockers and closure plan

A blocker is included here because its absence can change architecture, data safety, interoperability, security, or a public claim.

## B01 Immutable repository state

**Blocked:** Current HEAD, working tree, PR overlap, and CI are unresolved.  
**Close by:** Record repository, branch, immutable SHA, `git status`, relevant PRs, and required checks in the ZEUS task.  
**Evidence:** Command outputs and GitHub URLs captured in the implementation PR.

## B02 Repository instructions and invariants

**Blocked:** `CLAUDE.md`, `.zeus/FAST-KERNEL.md`, and `.zeus/INVARIANTS.md` were not read in this environment.  
**Close by:** ZEUS reads them before task compilation.  
**Evidence:** Handoff report lists file hashes and applicable requirements.

## B03 Working-copy authority

**Blocked:** Public status reports both SQLite-WASM/OPFS direction and Dexie/IndexedDB persistence.  
**Close by:** Accept an ADR defining canonical working copy, recovery journal, migration, and transition.  
**Evidence:** Crash, multi-tab, recovery, export, and reopen tests.

## B04 Production format identity

**Blocked:** Current application ID, user version, schema registry, and capability registry are unknown.  
**Close by:** Inventory repository constants and migrations. Allocate changes through an ADR.  
**Evidence:** Golden fixtures opened by old and new readers according to compatibility policy.

## B05 Deterministic canonical encoding

**Blocked:** Package demonstrations use deterministic JSON with float rejection. Production CBOR is not implemented.  
**Close by:** Choose a deterministic encoding profile, pin libraries, publish test vectors, and pass two independent implementations.  
**Evidence:** Byte-for-byte fixtures across TypeScript, Rust, and at least one independent reader.

## B06 Current SQLite-WASM behaviour

**Blocked:** Package tests use Python SQLite 3.46.1, not upstream 3.53.4 or browser WASM.  
**Close by:** Pin the repository SQLite/WASM build and run OPFS tests on supported browsers.  
**Evidence:** Version string, source hash, browser matrix, power-loss injection, and sidecar-free publication tests.

## B07 Geometry kernel decision

**Blocked:** No accepted exact-solid kernel or neutral adapter contract.  
**Close by:** Run a bakeoff using ARQ fixtures and licensing constraints.  
**Evidence:** Robustness, topology lineage, WASM size, performance, repair, import/export, and licence report.

## B08 Persistent topology naming

**Blocked:** No production implementation or change corpus.  
**Close by:** Implement explicit selection states and test edits that split, merge, reorder, delete, and regenerate topology.  
**Evidence:** Golden selector fixtures with exact, rebound, ambiguous, missing, and invalidated outcomes.

## B09 Interoperability conformance

**Blocked:** No independent corpus proves IFC, STEP, DWG, DXF, USD, glTF, CityGML, or 3D Tiles fidelity.  
**Close by:** Define named profiles and create licensed fixtures.  
**Evidence:** Import and export reports plus third-party validation.

## B10 MCP client compatibility

**Blocked:** The ecosystem is migrating from 2025-11-25 to 2026-07-28. TypeScript v2 requires explicit opt-in.  
**Close by:** Inventory target clients, select SDK versions, implement primary and compatibility transports, and test protocol negotiation.  
**Evidence:** Conformance matrix for each supported client.

## B11 Security review

**Blocked:** No production threat model or independent review of hostile `.arq` files and MCP actions.  
**Close by:** Complete parser, SQLite, extension, asset, decompression, URL, auth, replay, and supply-chain reviews.  
**Evidence:** Fuzz results, security tests, dependency SBOM, and remediation ledger.

## B12 Professional and regulatory claims

**Blocked:** ARQ cannot claim design correctness, code compliance, structural safety, accessibility, manufacturing readiness, or flightworthiness.  
**Close by:** Only scoped product claims backed by tests and qualified review may be published.  
**Evidence:** Language-system approval and claim ledger.

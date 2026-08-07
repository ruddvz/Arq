# ARQ Future Precision File System 5.0

**As of:** August 6, 2026, 11:58 America/Toronto  
**Package state:** Proposed architecture with executable package-local demonstrations  
**Repository mutation:** None  
**Production format allocation:** None

This package replaces the Version 4.0 research package as the current future file-system proposal. It corrects the external date baseline, audits the public repository state, removes generated cache files, adds a stateless MCP 2026-07-28 reference boundary, expands the normative contracts, and makes blocked work explicit.

It does not claim that the proposed format is implemented in the ARQ repository. Repository code, accepted ADRs, schemas, migrations, tests, CI, deployment evidence, and directly observed runtime remain authoritative.

## Read in this order

1. `01_EXECUTIVE_VERDICT.md`
2. `02_VERSION_4_FORENSIC_AUDIT.md`
3. `03_CURRENT_ARQ_STATE_2026-08-06.md`
4. `04_SYSTEM_ARCHITECTURE_MAP.md`
5. `06_BLOCKERS_AND_CLOSURE_PLAN.md`
6. `normative/00_SCOPE_AND_CONFORMANCE.md`
7. `mcp/00_MCP_2026_07_28_ARCHITECTURE.md`
8. `implementation/04_FIRST_VERTICAL_SLICE.md`
9. `handoff/ZEUS_TASK_HANDOFF.yaml`
10. `VALIDATION_REPORT.md`

## Package rules

- Every production identifier is unallocated until reconciled at immutable repository HEAD.
- The `ARQ5` SQLite application ID used by fixtures is package-only.
- A passing package-local test is not repository implementation evidence.
- Unknown required capabilities block editable opening.
- Invalid operations leave the previous canonical state unchanged.
- AI and MCP clients propose typed operations. They do not receive raw database authority.
- Exact interoperability claims require named editions, profiles, fixtures, and independent validation.
- Blocked items remain in the package with owners, prerequisites, evidence requirements, and closure tests.

## Main folders

- `audit/`: forensic audits and gap analysis
- `current-state/`: dated repository and standards observations
- `research/`: platform and format research
- `normative/`: candidate requirements
- `mcp/`: current MCP architecture and migration guidance
- `ux/`: full user workflows and failure states
- `implementation/`: repository sequencing, tests, performance, security, release, and rollback
- `schemas/`: candidate JSON Schema 2020-12 contracts
- `sql/`: candidate logical SQLite schema
- `reference/`: package-local Python demonstrations
- `fixtures/`: healthy and damaged `.arq` demonstrations
- `handoff/`: ZEUS compilation input
- `background/`: Operator OS authority and prior package

The goal is not the largest file format. The goal is a precise, recoverable, reviewable, evolvable project system whose claims are bounded by evidence.

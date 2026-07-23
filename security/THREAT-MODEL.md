# Threat model (ARQ-155)

Reproduces blueprint sections 115 ("Threat model") and 116 ("Controls")
verbatim, then adds one thing they do not have on their own: an honest status
against this repository's actual current implementation, not the finished
product the blueprint describes. Written at Phase 4 of the ordered backlog -
most backend/auth/import-parser work is still ahead in later phases, so most
threats below are correctly "not yet mitigated," not silently or falsely
marked done.

## Assets (section 115)

Private building designs; addresses; client information; exports; access
tokens; comments; audit records; AI prompts; imported files.

## Threats and their status in this repository today

| Threat                                         | Status              | Evidence / planned mitigation                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-tenant access                            | Not yet mitigated   | No multi-tenant backend exists yet - `api/`, `database/` are planning documents, not implemented services.                                                                                                                                                                                          |
| Malicious IFC, DXF, SVG or archive             | Partially mitigated | `.arq` archive integrity has real checksum verification (`@arq/project-format`'s `computeChecksums`/`verifyChecksums`, ARQ-077, reused by ARQ-146's cache-corruption recovery). `dxf-adapter`/`ifc-adapter` packages are still empty scaffolds - no parser exists yet to harden.                    |
| Zip bomb                                       | Partially mitigated | `@arq/project-format`'s `MAX_ARCHIVE_TOTAL_BYTES` (`complexity-limits.ts`, ARQ-157) caps the sum of every already-decoded archive entry's byte length, on top of `archive.ts`'s existing per-entry `MAX_ENTRY_BYTES` cap. The primary defense - rejecting a compressed container by its *expansion ratio*, before it is fully decompressed - still needs the not-yet-chosen zip library: `ARQ-238` (`backlog/issues/238-security-implement-resource-size-and-expansion-limits.md`).                             |
| Path traversal                                 | Mitigated (`.arq` only) | `archive.ts`'s `isPathSafe` (ARQ-079) rejects every unsafe entry path in a `.arq` archive before anything is read. No other file-import code exists yet to have this bug.                                                                                                                          |
| Parser memory exhaustion                       | Partially mitigated | `exceedsJsonComplexityLimits` (`complexity-limits.ts`, ARQ-157) caps every parsed archive section's JSON node count and nesting depth, generically (no wall/room semantics needed), using an iterative traversal so a hostile deeply-nested payload cannot itself overflow the call stack while being checked. `ARQ-238`'s expansion-ratio limit remains the primary defense one layer down, at the not-yet-chosen compressed-container layer.                                                                 |
| Denial of service through geometric complexity | Partially mitigated | `benchmarks/PERFORMANCE-BUDGETS.json`'s protected benchmark model (150 walls/80 openings/60 rooms/200 annotations) exists and is measured (ARQ-115 through ARQ-151), but there is no explicit _rejection_ of inputs beyond that complexity yet - only performance measurement at the expected size. |
| Prompt injection through imported text         | Not yet mitigated   | No AI/ArqScript pipeline is implemented yet (section 97-99 remain planning documents).                                                                                                                                                                                                              |
| Account takeover                               | Not yet mitigated   | No authentication is implemented yet (ADR-0016 "Authentication strategy" is still Proposed).                                                                                                                                                                                                        |
| Insecure share link                            | Not yet mitigated   | No sharing feature exists yet.                                                                                                                                                                                                                                                                      |
| Stale permission cache                         | Not yet mitigated   | No permission system is implemented yet; `security/RBAC-MATRIX.csv` is a design document, not enforced code.                                                                                                                                                                                        |
| Client-side secret exposure                    | No known instance   | This repository's client-side packages hold no secrets today - nothing to expose. Re-check this row whenever a real API key or token first enters client code.                                                                                                                                      |
| Supply-chain dependency                        | Actively managed    | Every adopted dependency is recorded with its licence and treatment in `open-source/TECHNOLOGY-MATRIX.csv`/`.json` (ARQ-017's dependency-and-licensing-policy, kept up to date through ARQ-115 - ARQ-153's additions).                                                                              |
| Malicious plugin later                         | Not applicable yet  | No plugin system exists; explicitly deferred, matching the threat's own "later."                                                                                                                                                                                                                    |

## Controls (section 116)

Tenant isolation; server-side authorisation; encrypted transport; encryption
at rest; signed short-lived URLs; private by default; share-link expiry;
optional password later; rate limits; file limits; complexity limits; parser
sandbox; Workers or isolated process; fuzzing; dependency scan; secret scan;
CSP; secure cookies; CSRF protection; audit events; deletion policy; backup
policy; incident runbook.

Of these, only **dependency scan** (the technology matrix above) and a form of
**complexity limits awareness** (the performance budget, not yet an enforced
rejection) have any real presence in this repository today. Everything else
depends on backend/auth/import infrastructure not yet built.

## "No sensitive project content is logged by default"

`@arq/telemetry` (this issue's natural home per its own README: "no raw
geometry, project names, or prompt text by default") had no code at all
before this issue - now has `redactSensitiveFields`
(`packages/telemetry/src/redact-sensitive-fields.ts`), a small, tested utility
that strips section 118's "do not collect by default" fields (geometry,
project name, address, raw prompt, sheet content, client name) from any
event object before it would be logged. This gives that promise real,
testable teeth rather than leaving it as prose with nothing enforcing it -
any future logging call site in this repository can (and should) route
through it.

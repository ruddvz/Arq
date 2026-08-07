# Blockers and closure plan

Nothing below is silently solved by this package.

| ID | Blocker | Required closure evidence |
|---|---|---|
| B01 | Immutable repository HEAD unresolved | SHA, branch, worktree, PR overlap, `CLAUDE.md`, `.zeus/FAST-KERNEL.md`, `.zeus/INVARIANTS.md` |
| B02 | Current SQLite application ID and schema allocation | Current code, migration tests, accepted ADR |
| B03 | Working-copy authority conflict | Accepted decision between OPFS SQLite, IndexedDB journal, or layered roles |
| B04 | AOGRP format acceptance | ADR, byte-level spec, two independent readers, golden vectors |
| B05 | Deterministic CBOR profile | Pinned libraries, exact restrictions, cross-language vectors |
| B06 | Hash agility and signing | Security review, algorithm registry, migration test |
| B07 | Append recovery correctness | Crash injection at every publication boundary on target platforms |
| B08 | Browser range and file access | Safari, Chromium, Firefox evidence with File System Access and fallback paths |
| B09 | Geometry kernel choice | Bakeoff on exact geometry, WASM, licence, robustness, payload portability |
| B10 | Persistent topology naming | Mutation corpus, ambiguity UX, no silent misbinding |
| B11 | Collaboration merge | Semantic conflict corpus and constraint revalidation |
| B12 | Pack garbage collection | Reachability proof, interrupted repack recovery, rollback |
| B13 | Encryption and signatures | Threat model, key lifecycle, metadata leakage review, recovery |
| B14 | Interchange profiles | Named edition/profile fixtures and independent validators |
| B15 | MCP production host | Current protocol, scoped grants, client tests, review centre, negative tests |
| B16 | Large model performance | Architecture, product, vehicle, and city fixtures with budgets |
| B17 | Migration from current `.arq` | Source-preserving converter, roundtrip report, rollback |
| B18 | Governed product claims | Language System approval tied to released evidence |

A blocker closes only when the listed evidence is revision-bound and reproducible. A document, prototype, isolated unit test, or successful build is insufficient by itself.

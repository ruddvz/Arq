# 2026-08-06 upload: "ARQ Future Precision System 6.0" (AOGRP) — triage notes

**Status: not adopted, and not recommended for adoption without a separate,
explicit repository decision.** This directory holds a zip the user uploaded
to a working session (`00_README_FIRST.md` is the pack's own index). The
repository's actual source of truth is unchanged: ADR-0019
(`docs/adr/0019-arq-native-sqlite-file-format.md`, **Status: Proposed**) and
`packages/arqfs` (SQLite, ARQ-195 onward) as the canonical semantic tier, with
`packages/local-storage` (Dexie/IndexedDB) as the derived, device-local tier —
see `docs/architecture/PERSISTENCE-AND-RECOVERY.md`.

This is a different lineage from the "v4.0 CORE" and "2026-07-24 CAD/BIM"
packages already triaged in the parent `docs/research/incoming/README.md`
and `2026-07-24-cad-bim-architecture-package/README.md`. It is the "Version
6.0" continuation of a "Version 5.0" package the same lineage produced
earlier.

**Not kept verbatim, unlike prior packages in this directory**: the
upload's `background/` folder (3.2MB of a nested `ARQ_FUTURE_PRECISION_FILE_
SYSTEM_5.0_2026-08-06.zip`, which itself contained a nested `...4.0...zip` one
level deeper, plus a full parallel `version-5-expanded/` markdown tree largely
superseded by this package's own `normative-v6`/`reference-v6`/etc.) was
removed after initial staging. It was pure duplicate bulk — opaque nested
archives and a prior-version copy with no incremental review value once the
6.0 content and this triage exist — and kept the package at 3.9MB/382 files
for no reason. The package is now ~730KB. If the v4.0/v5.0 lineage is ever
needed again, it's still recoverable from this directory's git history.

## What this package actually proposes

A candidate binary file format ("AOGRP" — ARQ Object Graph and Revision
Pack) as a possible eventual alternative to `.arq`-as-SQLite. **Correction
to this document's earlier framing**: an independent architecture review
(below) found that the package's own normative text does not actually
propose AOGRP as a *complement* sitting alongside SQLite — `03_ARQ_NOT_A_
SQLITE_WRAPPER.md` and `05_SQLITE_AND_OTHER_ENGINE_BOUNDARIES.md` assign
AOGRP *canonical* status and demote SQLite to a disposable working-copy
cache. That is a proposed successor to ADR-0019's canonical-tier decision,
not a complement to it, and should be evaluated as such. The design itself:
content-addressed objects, a dual-superblock recovery header, append-only
revision segments, and a storage-adapter boundary that could sit under
SQLite, IndexedDB, or other backends. 25 non-normative candidate spec
documents live in `normative-v6/00`–`24` (envelope, codecs, object identity,
exact quantities, deterministic encoding, operations/revisions, merge,
dual-root recovery, GC, storage adapter ABI, geometry, topology selection,
assets, capabilities, federation, sync, interchange fidelity, simulation
evidence, security, SQLite migration, conformance, MCP harness, UI state
contract, and an explicit "release profile and non-claims" document).

## Independent verification of the package's own claims

The package's prose is written in a confident, promotional style ("verified,"
"passing," "corrected") that should not be taken at face value. It was
independently re-checked rather than summarized:

- **The 21 reference tests genuinely pass** — `python3 -m unittest discover
  -s reference-v6/tests -v` → `Ran 21 tests ... OK` — but only after
  installing `jsonschema` and `pyyaml`; the package ships no
  `requirements.txt` or vendored deps, so "21 passing tests" is conditional
  on that environment setup, not self-contained.
- **The 10 JSON Schemas** all pass `jsonschema.Draft202012Validator.check_schema`.
- **The 10 fixtures** regenerate byte-identically from
  `reference-v6/generate_fixtures.py`, and the CLI
  (`reference-v6/arq6/cli.py inspect`) reproduces every fixture's documented
  behavior in `fixtures-v6/EXPECTED_VERDICTS.json` — including the claimed
  "generation 2 uses the second recovery root," "one damaged root recovers,"
  and "two damaged roots fail safely" cases.
- **`MANIFEST_SHA256.txt`**: a 15-file random sample recomputed independently
  matched. `tools-v6/validate_package.py` runs clean.
- **No red flags**: no hardcoded secrets, no network calls, no `eval`/`exec`/
  `pickle`, and a targeted search for prompt-injection patterns ("ignore
  previous instructions," "skip review," "already approved," "bypass") found
  only *prohibitive* uses (e.g. "MUST NOT bypass validation") — never an
  instruction telling an agent to actually do those things.
- **Code quality**: the Python reference (`reference-v6/arq6/`, ~250 lines)
  is a competent narrow demo — real struct-packed dual superblocks with
  checksums, real crash-injection tests — not production code. No fuzzing, no
  streaming/large-file design, no real CBOR (explicitly a JSON stand-in), no
  encryption/signing despite the spec docs describing them. The package's own
  `VALIDATION_REPORT.md` states these limits; that self-disclosure checked
  out.

## The package's own stated scope — and why that matters here

`handoff-v6/REPOSITORY_IMPLEMENTATION_PROMPT.md` and
`handoff-v6/ZEUS_TASK_HANDOFF.yaml` are unusually well-scoped for an
unsolicited proposal, and this repository is honoring that scope rather than
going beyond it:

- Self-labeled "Class E research, not repository authority."
- `delivery_stop: reviewed-plan`.
- Explicit non-goals: **no production format replacement, no in-place
  migration, no branch/PR/deployment/settings mutation unless separately
  authorised.**
- "Do not accept the custom format because it appears innovative. Require
  measurable benefits..."
- "Stop at the authorised delivery boundary."

That request lines up exactly with this repository's own precedent for
handling this lineage of packages (see the two prior triage READMEs
referenced above) and with the engineering gate: any change touching `.arq`
semantics classifies as **lane L4 / blast-radius "persistent"**
(`engineering/ops/engineering-policy.v5.json`, `.zeus/blast-radius.json`),
requiring designated-owner review — which a package's own self-assessment
cannot substitute for.

## What was checked against the current codebase, and found not applicable

The package's headline claim is a "recovery defect found and corrected" in
its own dual-generation-superblock root rotation. The current `.arq`
recovery path (`packages/arqfs/src/arqfs-node-atomic-swap.ts`) uses a
different, already-mature design for a single mutable SQLite file: one
canonical path plus one backup path, fsync-ordered atomic rename, and
crash-injection test seams (`onStage` hooks) covering the equivalent failure
classes (backup preserved on early failure, rollback-from-backup on late
failure, stale WAL/SHM sidecars parked and only discarded on success). AOGRP's
dual-generation-root scheme is designed for an immutable, content-addressed
pack format and doesn't map onto a single mutable database file — there was
no transferable bug and no fix was applied.

## Independent adversarial review (2026-08-07): concrete bugs and gaps found

Three independent reviews (file-integrity, architecture, security/AI-trust
boundary) were run against this package after the initial triage above, to
find concrete defects rather than restate the package's own claims. All
three read the actual code and specs, not the summary. Ranked by severity:

**Critical — exploitable bugs, verified against the actual reference code:**

1. **Dual-root recovery has no fallback path (reproduced).**
   `format.py`'s `open_manifest()` picks the highest-generation root and
   reads its manifest segment uncaught. If that root's superblock struct is
   intact but the segment *content* it points to is corrupted, the reader
   throws instead of falling back to the older, still-valid root —
   defeating the entire point of dual-root recovery. Reproduced directly:
   corrupting only the newer root's manifest payload (leaving the older
   root, and the newer root's own superblock checksum, untouched) makes
   `open_manifest` fail outright. Every existing fixture only corrupts the
   *older* slot's superblock struct; the adversarial case (newer root's
   *content* corrupt, older root sound) is untested and unhandled.
2. **MCP approval replay bug.** `mcp.py`'s `approve()` can be called
   repeatedly on one proposal, minting multiple live tokens; `consume()`
   never checks the proposal's status before returning operations. A
   second still-valid token from an earlier `approve()` call replays the
   same operations after the first has already committed. The included
   test only reuses the *same* token, never a second one.
3. **Approval isn't bound to a live "current head" check (TOCTOU).** The
   exact-digest binding covers the proposal payload only; nothing re-checks
   that `base_revision` still equals the file's actual current revision
   before treating an approved digest as ready to commit, despite
   `22_MCP_AND_AUTOMATION_HARNESS.md` claiming the host validates this.
4. **No aggregate decompression budget (zip-bomb path).** Each segment is
   size-capped individually, but `deep_validate()` fully decompresses every
   segment into memory before checking any total. A ~1GB crafted file using
   near-maximal zlib ratios could force hundreds of GB into memory before
   any limit rejects it — reachable via `cli.py inspect --deep` on an
   untrusted file.

**High — architecture problems, not implementation bugs:**

5. See the correction above: the package proposes succeeding ADR-0019, not
   complementing it.
6. **A second content-addressed ID scheme with no defined relationship to
   the one Arq already ships.** `packages/arqfs` already does SHA-256
   content-addressed resource chunking, and Arq already has a real stable
   entity ID (`ElementId`, `@arq/bim-core`). AOGRP's "content identifier"
   and "stable entity ID" never state whether they reuse or replace either.
7. **A second, competing operation/revision history model**, parallel to
   the real, shipped `@arq/operations` + `@arq/sync-protocol` typed
   operation contract, with zero conversion code and no defined bridge.
8. **The storage-adapter recovery contract is asserted, not defined** —
   "adapters must produce the same identities or report a failure" never
   says what "report a failure" does. `packages/arqfs`'s real atomic-swap
   code already has a concrete, tested answer that this spec is strictly
   weaker than.

**Medium — real gaps, safety unverifiable from this package:**

9. Hash-agility is claimed (citing Git's hash-transition design) but not
   built — hashes are raw 32-byte fields with no algorithm tag anywhere.
10. Garbage collection is entirely unimplemented — zero code, zero tests.
    Its reachability/safety claims cannot be verified from this package.
11. Capability claims aren't cross-validated against actual segment
    content — a file could under- or over-declare requirements to gain
    higher-trust mode or force a downgrade.
12. The binary envelope spec explicitly defers byte widths/order/magic to
    a future ADR, so it currently gives no overflow-safety requirement for
    a non-Python (C/Rust) implementation to follow.

**Low — disclosure problems, not defects:**

13. Encryption/signing (`19_SECURITY_LIMITS_ENCRYPTION_SIGNING.md`) is
    written in present tense with zero implementation; its "not real yet"
    disclaimer lives in a different document (`24`), so doc 19 read alone
    is misleading.
14. SQLite migration (`20_MIGRATION_FROM_SQLITE_ARQ.md`) is unimplemented
    prose — no code.
15. A file with a corrupted data segment still opens in shallow "editable"
    mode; only `--deep` catches it, and fixture verdicts don't distinguish
    the two — a tool trusting the shallow check alone would report a
    corrupt file as healthy.
16. CRDT/merge conflicts for precision geometry are named but not
    resolved — honestly left open, not hidden.

## Fixes applied in this repo (2026-08-07)

Findings 1–4 (the exploitable reference-implementation bugs) were fixed
directly in the staged `reference-v6/` code, not just documented, since
fixing them was tractable, isolated, and made the staged material actually
trustworthy for anyone reading it later:

1. **Dual-root fallback** — `format.py`'s `open_manifest()` now sorts
   candidate roots by generation descending and tries each in turn, catching
   `ArqFormatError` per root and only failing once every root has been
   content-verified and rejected — not just struct-checksum-verified.
2. **MCP replay** — `mcp.py`'s `approve()` now refuses to mint a token for a
   proposal that isn't `"draft"`; `consume()` independently refuses a token
   whose proposal isn't `"approved"`, as defence in depth.
3. **TOCTOU** — `mcp.py`'s `consume()` now takes a required
   `current_base_revision` argument and rejects the commit if it no longer
   matches the proposal's approved `base_revision`.
4. **Zip-bomb budget** — `format.py`'s `_read_segment()` now takes an
   optional running budget tracker; `deep_validate()` threads one across a
   full validation pass and aborts once cumulative decompressed bytes exceed
   `Limits.max_total_uncompressed`, instead of only capping each segment in
   isolation.

Six new regression tests were added (`test_newer_root_content_corrupt_falls_
back_to_older_root`, `test_both_roots_content_corrupt_fail`,
`test_reapproval_minting_a_second_token_is_rejected`,
`test_consume_after_status_desync_is_rejected`,
`test_stale_base_revision_is_rejected`,
`test_aggregate_decompression_budget_enforced`) covering exactly the
adversarial cases the original 21 tests missed. Full suite:
`python3 -m unittest discover -s reference-v6/tests -v` → **27 tests, all
pass**. All 10 fixtures in `fixtures-v6/` were re-run through
`reference-v6/arq6/cli.py inspect --deep` after the fix and still produce
the exact generation/mode/verdict recorded in `EXPECTED_VERDICTS.json` — the
fix changes only the previously-untested failure path, not documented
passing behavior.

**`MANIFEST_SHA256.txt` and `PACKAGE_INVENTORY.json` are now stale by
design** for every file touched by this pruning-and-fixing pass — they
record hashes for the *original, unmodified upload*. That's an intentional,
disclosed divergence, not silent drift: this file is the record of what
changed and why. Findings 6–16 (architecture and lower-severity gaps) were
not fixed — they're either specification-level (not somewhere `reference-v6/`
code can fix them), or genuinely require a repository decision this triage
doesn't have authority to make.

## Recommendation

Nothing here should be applied to `packages/`, `docs/adr/`, or
`.zeus/modules/arqfs.md` without a specific decision and the user's explicit
go-ahead — both because the repository's SQLite direction (ADR-0019) is
already partially implemented and shipped-against (`packages/arqfs`,
ARQ-195 onward), and because the package's own handoff docs ask for exactly
this stopping point. Findings 1–4 are now fixed in `reference-v6/` (see
above), which removes that specific blocker for future experimentation, but
does not change the architecture-level findings (6–8) or the underlying
governance requirement. Concrete, non-committal follow-ups if this is ever
revisited:

1. `normative-v6/08_DUAL_ROOT_APPEND_AND_RECOVERY.md` and
   `normative-v6/20_MIGRATION_FROM_SQLITE_ARQ.md` are worth a read if a
   future ADR ever proposes federation/partial-clone or offline-sync work
   that the current SQLite-only design doesn't cover — those are the two
   capabilities AOGRP's design targets that aren't native to a single mutable
   SQLite file.
3. If a "dual-format vertical slice" is ever authorised, it should live
   behind a feature flag with non-production identifiers, exactly as
   `handoff-v6/REPOSITORY_IMPLEMENTATION_PROMPT.md` itself asks for — not as
   a default code path, and only after resolving findings 6–8's identity/
   operation-model collisions with what's already shipped.
4. The reference implementation (`reference-v6/`) and fixtures
   (`fixtures-v6/`) are preserved here, verified working for what they
   actually test (not for what findings 1–16 show they don't cover), as a
   starting point for that slice if it's ever greenlit — not wired into
   this monorepo's build or test suite.

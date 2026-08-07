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

## Fixes applied in this repo (2026-08-07, two passes)

**Pass 1 — findings 1–4, the exploitable reference-implementation bugs:**

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

**Pass 2 — findings 8–15, addressed as far as each one honestly can be:**

| # | Finding | Resolution |
|---|---|---|
| 5 | Package succeeds ADR-0019, doesn't complement it | Documented above (framing correction, not a code fix) |
| 6 | Second content-addressed ID scheme, no mapping to Arq's `ElementId`/resource-chunk hashing | **Not completable here** — see "What can't be completed by this triage" below |
| 7 | Second, competing operation/revision model vs `@arq/operations` + `@arq/sync-protocol` | **Not completable here** — see below |
| 8 | Storage-adapter recovery contract asserted, not defined | **Fixed (doc)** — `normative-v6/10_STORAGE_ADAPTER_ABI.md` now has a concrete four-point contract (detect-before-visibility, no-replace-on-failure, three explicit host actions, exactly-two-states-after-crash), modeled on `packages/arqfs/src/arqfs-node-atomic-swap.ts`'s real, tested behavior without copying it wholesale |
| 9 | Hash-agility claimed (citing Git), not built | **Fixed (doc correction)** — `research-v6/07_MERKLE_DAG_AND_HASH_AGILITY.md` and `normative-v6/05_DETERMINISTIC_ENCODING_AND_HASHES.md` corrected: the false "hash references include algorithm and profile IDs" claim is removed, and the actual mechanism (profile-level version gating via the boot header, not per-object dual-hash coexistence) is now accurately described, with the honest reasoning for why Git's model doesn't fit a single-writer mutable file |
| 10 | Garbage collection entirely unimplemented | **Fixed (code)** — `format.py`'s new `gc_repack()` is a real, history-preserving compaction (see below) with 4 new tests |
| 11 | Capability claims not cross-validated against segment content | **Fixed (code)** — `open_manifest()` now cross-checks declared `required_capabilities`/`optional_capabilities` against the segment types the manifest actually lists, rejecting under-declaration, with 2 new tests |
| 12 | Envelope spec gives no overflow-safety requirement | **Fixed (doc)** — `normative-v6/01_AOGRP_BINARY_ENVELOPE.md` now explicitly requires checked/saturating arithmetic for offset+length validation in any conforming (non-Python) implementation |
| 13 | Encryption/signing claim misleading in isolation | **Fixed (doc)** — `normative-v6/19_SECURITY_LIMITS_ENCRYPTION_SIGNING.md` now has an implementation-status banner co-located with the claim itself |
| 14 | SQLite migration is unimplemented prose | **Fixed (bounded code)** — new `reference-v6/arq6/migrate.py` implements read-only inspection and row-to-object translation for real, against a synthetic schema (not Arq's actual `.arq` schema — see below), with 6 new tests including a proof that the source file is byte-for-byte unchanged after inspection |
| 15 | Shallow open doesn't certify segment integrity, verdict looks identical to deep | **Fixed (code)** — `open_manifest()`/`deep_validate()` now return an explicit `content_verified` field (`False`/`True`), surfaced through `cli.py`'s output, with 1 new test |
| 16 | CRDT/merge conflicts named but unresolved | **Left open, honestly** — see below; not fabricated |

Ten new regression tests from findings 10/11/15, plus 6 from finding 14's
migration module, plus the original 6 from findings 1–4: **40 tests total,
all pass** (`python3 -m unittest discover -s reference-v6/tests -v`). All 10
fixtures in `fixtures-v6/` re-verified unchanged against
`EXPECTED_VERDICTS.json` after every code change in both passes.

### What can't be completed by this triage (6, 7)

Findings 6 and 7 both describe the same underlying issue: AOGRP defines a
content-addressed object identity and an operation/revision history model
with no stated relationship to the ones Arq already ships
(`ElementId`/`@arq/bim-core`, `packages/arqfs`'s resource-chunk hashing,
`@arq/operations`'s `ModelOperation`, `@arq/sync-protocol`'s
`OperationEnvelope`). This can't be fixed by editing `reference-v6/` or the
normative docs, because there is no single correct answer to write down —
it's a real architecture decision with at least three genuinely different
resolutions, and picking one is exactly the kind of choice
`engineering/30_ZEUS_AND_ENGINEERING_AUTHORITY.md` reserves for a designated
owner, not something this triage should decide by editing a document:

1. **AOGRP IDs/operations are demoted to interchange-only** — never used as
   Arq's live identity or history inside the app; AOGRP is purely an export/
   snapshot format, and a translation layer maps `ElementId` ↔ AOGRP content
   ID and `ModelOperation` ↔ AOGRP operation group only at export/import
   boundaries. Lowest risk, closest to what `03_ARQ_NOT_A_SQLITE_WRAPPER.md`
   claims to want (despite the framing correction in finding 5) — but this
   is a genuine constraint AOGRP's own normative docs don't currently state.
2. **`ElementId` is redefined to *be* (or be derived from) an AOGRP content
   ID**, unifying identity but requiring every existing `ElementId`
   reference in the shipped codebase to either migrate or gain a
   translation shim — a real, cross-cutting, hard-to-reverse change.
3. **AOGRP's operation model is dropped in favor of `ModelOperation`/
   `OperationEnvelope`**, and AOGRP becomes purely a byte-level pack format
   for whatever operation representation Arq already uses — narrows AOGRP's
   scope but removes the duplication finding 7 flags.

This triage is not the place to choose between these — it's the place to
make sure the choice, when made, is made with this list in hand rather than
discovered later as an integration surprise.

### What was deliberately not fully solved (14, 16)

**Finding 14's migration demo is real but intentionally narrow.** It proves
the read-only-then-translate mechanism works; it does not read Arq's actual
`packages/arqfs` schema or propose a real column-by-column mapping for any
actual Arq entity type, because that mapping decision has the same "not
this triage's call" status as findings 6–7 above — see
`normative-v6/20_MIGRATION_FROM_SQLITE_ARQ.md`'s updated implementation-
status note.

**Finding 16 (CRDT/merge conflicts) was not resolved, and no algorithm was
invented for it.** It remains a real, open problem — the package's own
`research-v6/09_CRDT_OT_AND_PRECISION_CONFLICTS.md` correctly identifies
that generic CRDTs are unsafe for constrained geometry, and
`normative-v6/07_BRANCH_MERGE_AND_CONFLICTS.md` lists conflict categories
without defining a merge algorithm. Worth noting for context: Arq's real,
shipped `packages/sync-protocol/src/conflict-classification.ts` already
implements exactly the approach the package's own research doc recommends
instead of CRDTs — a real, tested, standard optimistic-concurrency
touched-entity-set conflict classifier (`classifyConflict()`, "no-conflict"
/ "concurrent-write" / "write-after-delete"), not a placeholder. AOGRP's own
`normative-v6/07_BRANCH_MERGE_AND_CONFLICTS.md` doesn't reference it. That's
additional evidence for findings 6–7's core point — Arq already has real
answers AOGRP's docs don't engage with — not a fix to the actual open
merge-semantics-for-geometry research question, which remains open.

**`MANIFEST_SHA256.txt` and `PACKAGE_INVENTORY.json` are stale by design**
for every file touched across both fix passes — they record hashes for the
*original, unmodified upload*. That's an intentional, disclosed divergence:
this file is the record of what changed and why.

## Recommendation

Nothing here should be applied to `packages/`, `docs/adr/`, or
`.zeus/modules/arqfs.md` without a specific decision and the user's explicit
go-ahead — both because the repository's SQLite direction (ADR-0019) is
already partially implemented and shipped-against (`packages/arqfs`,
ARQ-195 onward), and because the package's own handoff docs ask for exactly
this stopping point. Findings 1–4, 8–15 are now fixed or documented in
`reference-v6/`/`normative-v6/` (see above); findings 6, 7, and 16 remain
open by necessity, not by omission. Concrete, non-committal follow-ups if
this is ever revisited:

1. Findings 6–7's reconciliation options (above) are the actual decision
   that has to be made before any AOGRP concept touches live Arq identity or
   history — read those first, before the normative docs.
2. `normative-v6/08_DUAL_ROOT_APPEND_AND_RECOVERY.md` and
   `normative-v6/20_MIGRATION_FROM_SQLITE_ARQ.md` are worth a read if a
   future ADR ever proposes federation/partial-clone or offline-sync work
   that the current SQLite-only design doesn't cover — those are the two
   capabilities AOGRP's design targets that aren't native to a single mutable
   SQLite file.
3. If a "dual-format vertical slice" is ever authorised, it should live
   behind a feature flag with non-production identifiers, exactly as
   `handoff-v6/REPOSITORY_IMPLEMENTATION_PROMPT.md` itself asks for — not as
   a default code path, and only after resolving findings 6–7's identity/
   operation-model collisions with what's already shipped.
4. The reference implementation (`reference-v6/`), including the new
   `gc_repack()` and `migrate.py`, and fixtures (`fixtures-v6/`) are
   preserved here, verified working for what they actually test, as a
   starting point for that slice if it's ever greenlit — not wired into
   this monorepo's build or test suite.

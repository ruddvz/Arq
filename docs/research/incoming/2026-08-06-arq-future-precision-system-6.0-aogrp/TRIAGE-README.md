# 2026-08-06 upload: "ARQ Future Precision System 6.0" (AOGRP) — triage notes

**Status: not adopted, and not recommended for adoption without a separate,
explicit repository decision.** This directory holds a zip the user uploaded
to a working session, stored verbatim (`00_README_FIRST.md` is the pack's own
index). The repository's actual source of truth is unchanged: ADR-0019
(`docs/adr/0019-arq-native-sqlite-file-format.md`, **Status: Proposed**) and
`packages/arqfs` (SQLite, ARQ-195 onward) as the canonical semantic tier, with
`packages/local-storage` (Dexie/IndexedDB) as the derived, device-local tier —
see `docs/architecture/PERSISTENCE-AND-RECOVERY.md`.

This is a different lineage from the "v4.0 CORE" and "2026-07-24 CAD/BIM"
packages already triaged in the parent `docs/research/incoming/README.md`
and `2026-07-24-cad-bim-architecture-package/README.md`. It is the "Version
6.0" continuation of a "Version 5.0" package the same lineage produced
earlier (`background/ARQ_FUTURE_PRECISION_FILE_SYSTEM_5.0_2026-08-06.zip`,
itself containing a "Version 4.0" package one level deeper) — both are kept
here unextracted, as the pack's own background material.

## What this package actually proposes

A candidate binary file format ("AOGRP" — ARQ Object Graph and Revision
Pack) as a possible eventual alternative or complement to `.arq`-as-SQLite:
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

## Recommendation

Nothing here should be applied to `packages/`, `docs/adr/`, or
`.zeus/modules/arqfs.md` without a specific decision and the user's explicit
go-ahead — both because the repository's SQLite direction (ADR-0019) is
already partially implemented and shipped-against (`packages/arqfs`,
ARQ-195 onward), and because the package's own handoff docs ask for exactly
this stopping point. Concrete, non-committal follow-ups if this is ever
revisited:

1. `normative-v6/08_DUAL_ROOT_APPEND_AND_RECOVERY.md` and
   `normative-v6/20_MIGRATION_FROM_SQLITE_ARQ.md` are worth a read if a
   future ADR ever proposes federation/partial-clone or offline-sync work
   that the current SQLite-only design doesn't cover — those are the two
   capabilities AOGRP's design targets that aren't native to a single mutable
   SQLite file.
2. If a "dual-format vertical slice" is ever authorised, it should live
   behind a feature flag with non-production identifiers, exactly as
   `handoff-v6/REPOSITORY_IMPLEMENTATION_PROMPT.md` itself asks for — not as
   a default code path.
3. The reference implementation (`reference-v6/`) and fixtures
   (`fixtures-v6/`) are preserved here, verified working, as a starting
   point for that slice if it's ever greenlit — not wired into this
   monorepo's build or test suite.

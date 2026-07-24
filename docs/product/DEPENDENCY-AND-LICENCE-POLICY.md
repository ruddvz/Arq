# Dependency and licence policy

ARQ-003. Governs every dependency added anywhere in this monorepo (root, any
`packages/*`, `apps/*`, `workers/*`, or `rust/*`). Complements, but does not
replace, ADR-0017 ("Dependency and licensing policy"), which records the
architectural decision to require SPDX/SBOM tracking; this document is the
concrete, enforced policy that decision produces.

## Licence allow-list

A dependency's licence must be one of the following (SPDX identifiers) to be
added without further review:

- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC
- 0BSD
- Unlicense
- CC0-1.0
- Python-2.0
- Zlib

A compound "OR" expression (e.g. `(MIT OR Apache-2.0)`, `(BSD-2-Clause OR MIT
OR Apache-2.0)`) is allowed if **at least one** of its branches is on this
list — the consumer can always choose the permissive branch. A compound
"AND" expression (e.g. `(MIT AND Zlib)`, both licences applying
simultaneously) is allowed only if **every** branch is on this list — there
is no escaping the stricter one.

**Allowed with review, not blanket-allowed**: weak-copyleft licences with a
file-level (not whole-program) copyleft scope - MPL-2.0, LGPL-2.1,
LGPL-3.0 - may be used for a dependency consumed only as a compiled
library/data file we do not modify (never for a dependency we fork or patch
in-tree). Record the specific package and reasoning in this file's "Reviewed
exceptions" section below when one is added.

**Never allowed** without an explicit, separately-approved ADR: GPL-2.0,
GPL-3.0, AGPL-3.0, SSPL, or any licence with a field-of-use, "no commercial
use," or copyleft-the-whole-program condition - these are incompatible with
shipping Arq as licensed, closed-source commercial software (blueprint
section 114, "Licence rules").

## Reviewed exceptions (weak-copyleft dependencies currently in use)

| Package        | Licence   | Why it's safe                                                                                                                                                                                                                 | Scope                            |
| -------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `web-ifc`      | MPL-2.0   | Consumed as a compiled WASM/JS library (`packages/ifc-adapter`) via its published API only - never forked or patched in-tree. MPL-2.0's copyleft applies only to modifications of its own source files, which we do not make. | Runtime dependency               |
| `caniuse-lite` | CC-BY-4.0 | Browser-compatibility data only (a transitive dependency of build tooling, e.g. browserslist/postcss), not code we link or ship in the product bundle.                                                                        | Build-time transitive dependency |

## Enforcement

`scripts/check-dependency-licences.mjs` runs `pnpm licenses list --json`
against the allow-list above and fails (non-zero exit) if it finds a licence
outside the allow-list or the reviewed-exceptions list, printing exactly
which package(s) and licence(s) failed. Wired into CI as the
`dependency-licence-scan` job in `.github/workflows/ci.yml`, so an
unreviewed disallowed licence blocks the PR rather than being discovered
later.

The same script writes `dependency-sbom.json` (name, version, licence per
installed package) as a build artifact - a minimal software bill of
materials. A full CycloneDX/SPDX-format SBOM generator is not adopted here:
it would be a new dependency for a capability `pnpm licenses list --json`
(already installed, since pnpm itself is) already provides in a simpler
shape sufficient for this policy's actual need (licence enforcement plus an
auditable package/version manifest), matching this repository's standing
"don't add a dependency for headroom you haven't shown you need" discipline
(the same reasoning ADR-0008 already applied to the 2D renderer choice).

## Adding a new dependency

1. Check its licence against the allow-list above.
2. If it's on the allow-list: add it normally; `check-dependency-licences.mjs`
   passes without any change to this file.
3. If it's a weak-copyleft licence used only as an unmodified compiled
   library/data file: add a row to "Reviewed exceptions" in the same commit,
   explaining scope and why it's safe, and add its exact licence string to
   `scripts/check-dependency-licences.mjs`'s `REVIEWED_EXCEPTION_LICENCES`.
4. If it's anything else (strong copyleft, field-of-use restricted, unknown/
   unlicensed): do not add it without a dedicated ADR recording the decision.

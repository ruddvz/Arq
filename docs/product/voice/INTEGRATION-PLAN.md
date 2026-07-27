# Integration plan for Arq Language System 4.1

Use `install-map.json` as the authoritative package-to-repository map and run
`verify-install-map.mjs` before integration. The map is intentionally complete:
it copies snapshots consumed by the bundle builder, state adapters, claim
bindings, message contracts and all repository-run machine checks.

## Phase 1: reconcile truth before wiring tools

1. Resolve the 3D `STATUS.md` contradiction against current code/tests.
2. Decide the relationship between the demo IndexedDB journal and the native
   `.arq` SQLite/OPFS direction through an ADR.
3. Apply the public-copy corrections in `PUBLIC-COPY-RECONCILIATION.md` and
   `GITHUB-PAGES-LIVE-AUDIT-2026-07-27.md`.
4. Inventory every public content file. Bind rendered current assertions to
   claim IDs and classify the remainder explicitly. Do not use a free-form FAQ
   as the support source of truth.
5. Apply the U+2014 remediation before activating the hard gate. Do not add an
   acknowledgement for a hard punctuation violation.

## Phase 2: install and merge

- replace/create `docs/product/VOICE-SYSTEM.md`;
- merge, never overwrite blindly, `PRODUCT-COPY-PRINCIPLES.md`;
- copy canonical data under `docs/product/voice/`;
- copy machine checks under `scripts/`;
- add package scripts and CI steps;
- add the rendered-site claim-test fragment to the public-site suite.
- merge `deploy-pages.fragment.yml` into the GitHub Pages workflow;
- run the installed-repository, public-inventory, route-coverage and
  editorial-policy checks.

## Phase 3: generate and verify context

Run refresh only after the source correction. The generated context stores a
source-set digest, no developer path, and directory membership hashes. Context
refresh fails rather than overwriting a good context from missing sources.

## Phase 4: enforce in CI

The CI order is source contract, installed repository, public inventory, route
coverage, context freshness, canonical data, editorial policy, state and adapter
coverage, conflict gate, claim gate, wiring, language audit and static public
site audit. Deployment then writes a proof into the Pages artifact and verifies
the committed proof and route hashes after GitHub Pages publishes it. Existing
rendered-site, product, browser, type, build and Rust checks remain required.

## Phase 5: publish consumers

Support and product AI consume only a passing language context from the same
source digest. They keep an evidence envelope and may not turn a `LIBRARY_ONLY`,
`PLANNED`, `CONFLICTED`, `UNKNOWN` or `VOLATILE` fact into an unqualified current
answer.

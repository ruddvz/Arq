# ARQ capability ledger

Issue #370 owns the projection that answers one question: **what can the current product actually do, with what evidence?**

The machine seed is `ARQ-CAPABILITY-DEFINITIONS.json`. It may name stable capability IDs, provider authorities, source/test/product-execution evidence, approved human-evidence receipts, accessibility/performance evidence, product surfaces, platforms, journeys, release gates and explicit maturity weights. It must not author derived truth such as `maturity`, `availability`, `productReachabilityState`, `productExecutionPath`, `libraryBacking` or the derived evidence-status fields; those are computed by `scripts/lib/capability-ledger.mjs`.

Run `node scripts/build-capability-ledger.mjs` to generate:

- `docs/product/capabilities/ARQ-CAPABILITY-LEDGER.json`
- `docs/product/ARQ-CAPABILITY-DASHBOARD.md`

`.github/workflows/capability-ledger.yml` runs the same generator from the exact CI checkout, uploads both outputs as evidence and fails when the checked-in generated files differ. Generated output is therefore reviewable but must never be hand-edited.

The generator consumes #420 command/tool truth rather than creating another command registry. Repository backing and product reachability remain separate facts. A candidate or open PR is evidence, not current-product truth: any capability that depends on an unmerged provider is capped below `verified_current`.

A product-facing capability needs source, test and product-execution evidence before it can become `verified_current`. Package-level implementation or tests do not prove a user-reachable product path. Command/tool capabilities additionally inherit #420's exact reachability state, so repository-backed but unwired tools stay unavailable.

Human/browser/device proof is explicit. `humanEvidenceRequired: true` remains `human_evidence_required` until every declared `humanEvidencePaths` receipt exists. A human receipt does not replace missing source, test or execution proof. `accessibilityEvidenceRequired` and `performanceEvidenceRequired` work the same way for their declared evidence paths. The current browser/device matrix is a planning/source artifact, not an approved acceptance receipt.

Evidence fingerprints include the contents of every declared evidence file plus provider revision and command facts. When any of those inputs change, the fingerprint changes and regenerated output must be reviewed again.

The initial seed covers the required Core 1.0 capability families plus the reachability-risk tools identified by #398/#420. Later additions should extend stable IDs and provider/evidence bindings, not copy capability claims from prose, PR descriptions or public-site copy.

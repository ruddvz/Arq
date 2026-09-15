# ARQ capability ledger

Issue #370 owns the projection that answers one question: **what can the current product actually do, with what evidence?**

The machine seed is `ARQ-CAPABILITY-DEFINITIONS.json`. It may name stable capability IDs, provider authorities, source/test evidence, product surfaces, platforms, journeys, release gates and explicit maturity weights. It must not author `maturity`, `availability`, `productExecutionPath` or `libraryBacking`; those are derived by `scripts/lib/capability-ledger.mjs`.

Run `node scripts/build-capability-ledger.mjs` to generate:

- `docs/product/capabilities/ARQ-CAPABILITY-LEDGER.json`
- `docs/product/ARQ-CAPABILITY-DASHBOARD.md`

The generator consumes #420 command/tool truth rather than creating another command registry. Repository backing and product reachability remain separate facts. A candidate or open PR is evidence, not current-product truth: any capability that depends on an unmerged provider is capped below `verified_current`.

`verified_current` requires current evidence, a proven product execution path and no unmerged required provider. Human/browser/device evidence remains a separate maturity state and cannot be inferred from unit tests. Evidence fingerprints include file contents so a previously verified record becomes mechanically stale when its evidence changes.

The initial seed covers the required Core 1.0 capability families plus the reachability-risk tools identified by #398/#420. Later additions should extend stable IDs and provider bindings, not copy capability claims from prose, PR descriptions or public-site copy.

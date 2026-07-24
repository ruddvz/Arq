# @arq/derived-cache

Disposable derived-output contracts only. Canonical project data never depends on this package. The package uses deterministic canonical key material and SHA-256 through Web Crypto because ARQ Core 4.0 already standardises SHA-256; BLAKE3 remains an ADR/spike rather than an unreviewed dependency.

The "safe to delete" claim above is backed by a concrete test, not just this description: `src/store.test.ts`'s `'FP-036: a fully cleared cache is behaviourally indistinguishable from a brand-new one'` populates `MemoryDerivedCacheStore` with several records, calls `clearNamespace()`, and proves the store returns to its exact initial (empty) state - reads match a never-populated store, clearing an already-empty store doesn't throw, and post-clear writes behave identically to a fresh store.

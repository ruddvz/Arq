# Contributing

Arq is a proprietary project (see `LICENSE`). This file documents the working
conventions for whoever is contributing, per
`docs/product/ARQ-MASTER-PRODUCT-PLAN-v0.1.md` §29.

## Branches

- `main` is protected and releasable.
- Use short-lived feature branches; avoid a permanent development branch unless
  release operations require one.

## Pull requests

Every pull request should include:

- the problem being solved;
- the proposed solution;
- screenshots or recordings for UI changes;
- tests;
- performance impact;
- accessibility impact;
- file-format impact (if it touches import/export);
- migration impact (if it touches stored data/schemas);
- license impact for any new dependency (see §19's licensing policy).

## Required checks

Once CI exists, pull requests should pass: formatting, linting, type checking, unit
tests, geometry tests, visual regression (where relevant), license scan, dependency
vulnerability scan, bundle-size budget, and performance benchmarks for
performance-sensitive packages.

## Architecture decision records

Significant, hard-to-reverse decisions get an ADR under `docs/adr/` — see
`docs/adr/0000-template.md`. Per §29, this includes decisions like platform choice,
renderer choice, geometry kernel boundary, the semantic data model, project file
format, collaboration model, IFC strategy, AI operation model, native app strategy,
desktop packaging, and licensing.

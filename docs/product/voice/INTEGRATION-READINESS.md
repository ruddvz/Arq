# Integration readiness gate

Do this before copying the package into a working ARQ branch.

## Preconditions

- Work from the repository revision being reviewed. Do not combine this package
  with an unverified source snapshot.
- Preserve the existing product-copy principles and rendered-site tests.
- Resolve changes in a dedicated branch; do not update generated context in a
  broad unrelated feature PR.
- Read current accepted ADRs before promoting a roadmap, file or architecture
  claim.

## Required reconciliation work

1. Correct the contradictory 3D status line or retain the conflict with an
   explicit owner and unresolved-state evidence.
2. Reconcile public `.arq`, journal, import/export, hardware, privacy and AI
   copy using `00-audit/PUBLIC-COPY-RECONCILIATION.md`.
3. Add state adapters for the live plan journal and ensure every visible status
   reaches the message resolver.
4. Classify every file in `apps/marketing/src/content` in the public-copy
   inventory. Bind claim-bearing files and give non-claim files a reason. Check
   the inventory against `ROUTE-MAP.csv` and `routes.ts`.
5. Install all map destinations and run `arq:language:install:verify` before
   adding package scripts to CI.
6. Generate context only after the canonical source correction is committed.
7. Apply `deploy-pages.fragment.yml` and require a rendered-site proof before
   each GitHub Pages deployment is accepted.

## Activation sequence

```bash
pnpm arq:language:install:verify
pnpm arq:language:public:verify
pnpm arq:language:routes:verify
pnpm arq:language:editorial:verify
pnpm arq:language:refresh
pnpm arq:language:context:verify
pnpm arq:language:sources:verify
pnpm arq:language:state:verify
pnpm arq:language:conflicts:verify
pnpm arq:language:claims:verify
pnpm arq:language:verify
pnpm arq:language:audit:ci
pnpm --filter @arq/marketing build
pnpm arq:language:site:build:verify --site-root apps/marketing/dist
pnpm test
pnpm typecheck
pnpm build
```

Do not refresh in CI before `context:verify`. CI must verify the committed
context, then fail if it is stale.

## Release criterion

The support/AI language bundle may be published only from the same passing
revision as the generated context and its source digest. A package ZIP is a
distribution artifact, not authority over the repository.

The editorial check is not an authorship detector. It detects review-required
copy patterns and requires the reviewer to inspect evidence, specificity and
visible limits.

The deployment check is also mandatory. It must verify the deployed proof
commit and every public route hash before the live site is called compliant.

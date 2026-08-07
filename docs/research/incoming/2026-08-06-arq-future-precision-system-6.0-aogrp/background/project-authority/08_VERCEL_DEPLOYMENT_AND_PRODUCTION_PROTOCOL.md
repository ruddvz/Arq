---
source_id: ARQ-OS3-VERCEL-PROTOCOL
source_type: deployment-control
class: C
status: proposed-for-repository-adoption
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ release owner
---

# Vercel deployment and production protocol

## Role

Vercel distributes the marketing site and web application and supplies build, route, runtime, and rollback evidence. It is not canonical storage for ARQ project files, semantic model state, ADRs, or source truth.

## Provenance requirement

Every deployment must record:

- repository;
- expected source commit;
- actual source commit;
- build command and package-manager version;
- Node version;
- project and deployment ID;
- target environment;
- artifact or route hash;
- required checks and results;
- smoke-test results;
- rollback candidate;
- release owner and time.

If a bootstrap clones a branch, pass the expected SHA and fail when the checked-out SHA differs. Prefer a native Git-connected deployment or another mechanism that preserves immutable commit provenance.

## Current bootstrap critique

The observed project clones the repository branch during the Vercel build. This made the successful log traceable to a commit, but leaves a branch movement race. It also installs the whole 38-workspace monorepo and compiles a native SQLite dependency even though the deployed outputs are the marketing site and browser app.

## Build corrections

1. Pin Node and pnpm to the same tested policy in repository, CI, and Vercel.
2. Use a monorepo root, focused install, or pruned workspace that contains only required dependency closure.
3. Cache by lockfile, Node version, pnpm version, and source commit.
4. Avoid compiling server-only native dependencies for static browser outputs unless they are in the real build closure.
5. Split the web bundle by route and heavy capability. Add an explicit initial-JavaScript budget and fail on material regression.
6. Preserve licence and SBOM checks for the actual deployment closure.
7. Keep marketing output and `/app/` routing deterministic.
8. Emit a machine-readable provenance file into the deployment.

## Deployment sequence

1. Resolve merged or explicitly approved source SHA.
2. Confirm Engineering OS and Language System results for that SHA.
3. Build in a clean environment.
4. Verify provenance and artifact hashes.
5. Deploy preview.
6. Run root, product routes, legal routes, assets, `/app/`, and error-route checks.
7. Run accessibility and claim checks for rendered public pages.
8. Run browser capability smoke tests for the app paths affected.
9. Promote only with explicit authority.
10. Observe runtime errors and route health.
11. Record deployment evidence.
12. Roll back when the release acceptance or error threshold fails.

## Environment and secrets

Never print secret values. Verify only key presence, target environment, scope, and last update when available. Production variables must not be exposed to preview without an explicit need. Prefer platform-managed identity or scoped tokens over long-lived secrets where supported.

## Rollback

A release is not complete until a known-good rollback candidate is identified and the rollback route is documented. After rollback, verify aliases, root routes, `/app/`, static assets, and public claim state.

## Required smoke matrix

| Surface | Minimum evidence |
|---|---|
| `/` | 200, canonical metadata, asset load, claim audit |
| `/product` and governed public routes | 200, route inventory, copy gate |
| legal and security routes | 200, approved source binding |
| `/app/` | 200 shell plus browser runtime check |
| static brand assets | correct MIME, cache policy, no missing files |
| unknown route | intentional 404 behaviour |
| production headers | recorded security and cache headers |

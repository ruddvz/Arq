# Vercel deployment

## What was wrong

The repository had no `vercel.json`, so Vercel auto-detected the project and
did the only thing it could: `pnpm install` at the workspace root, then
`pnpm build`, which is `turbo run build` across the whole monorepo.

Two things follow from that, and both are fatal for a static marketing site.

A root install resolves every workspace package, and `packages/arqfs` depends
on `better-sqlite3`, a native addon that must be compiled against the running
Node ABI. The static site does not use it, has never used it, and cannot use
it: it is a build-time dependency of the `.arq` file layer. The deployment was
compiling a native SQLite binding in order to render eighteen HTML pages.

Then, with no `outputDirectory`, a build that did succeed still produced
nothing Vercel could serve, because the pages land in `apps/marketing/dist`
and nothing pointed there.

## What the configuration does

`installCommand` filters the install to `@arq/marketing...`, which is the
marketing package and its dependency closure. That closure is one entry,
`@types/node`. Measured rather than assumed:

```
pnpm ls --filter @arq/marketing... --depth Infinity | grep better-sqlite3   # no match
pnpm ls --filter '*'              --depth Infinity | grep -c better-sqlite3 # 2
```

No native module is in the deploy closure, so nothing is compiled.

`buildCommand` builds only that package, with the environment a root-served
host needs, and then writes the provenance record.

`SITE_BASE_PATH` is deliberately empty. GitHub Pages serves this site from
`/Arq`, so the Pages workflow sets `SITE_BASE_PATH=/Arq` and every internal URL
is prefixed. Vercel serves from the domain root, so the same prefix would make
every asset 404. The two hosts need different values and neither may be
hardcoded in the build.

`SITE_ORIGIN` prefers `VERCEL_PROJECT_PRODUCTION_URL` and falls back to
`VERCEL_URL`, so canonical URLs on a production deployment point at the stable
domain rather than at that deployment's unique hostname. A preview still gets
its own hostname, which is correct: a preview should not claim to be canonical
for the production URL.

## Provenance and the expected SHA

The build ends by writing `arq-deployment-provenance.json` into the output:
both SHAs, the toolchain, and a hash per route and per file.

It runs with `--allow-unpinned`, which needs explaining because it looks like a
weakened check. It is not. The flag only governs the case where no expected SHA
was supplied at all. If `EXPECTED_SOURCE_SHA` is set as a project environment
variable in Vercel, the build compares it against the actual checkout and fails
on mismatch regardless of this flag.

That is the honest split. A preview builds whatever the branch points at, so
there is no independent expectation to check it against and demanding one would
only produce a check that always passes. A production release is approved at a
specific revision, so set `EXPECTED_SOURCE_SHA` for the production environment
and a drifted branch stops the deployment instead of shipping a revision nobody
approved.

## What this does not do

It does not deploy the editor. `apps/web` is not built or served here, and
`/app/` is not routed. Only the marketing site is deployed.

It does not make Vercel the production host. GitHub Pages remains the published
site through `.github/workflows/deploy-pages.yml`, which is the workflow that
carries the required-SHA check. Vercel builds previews. Making it production is
a separate decision with its own record.

## Verifying a change locally

Reproduce what Vercel runs, without the install filter, since a local checkout
already has the workspace installed:

```
SITE_BASE_PATH= SITE_ORIGIN=https://example.invalid SITE_REVISION=$(git rev-parse HEAD) \
  pnpm --filter @arq/marketing build
node scripts/write-deployment-provenance.mjs --dist apps/marketing/dist --target vercel --allow-unpinned
```

Then confirm the two things that differ from the Pages build: no asset path
begins with `/Arq`, and every route carries a canonical URL on the host being
deployed to.

# Vercel deployment

Vercel builds one static artifact holding both public surfaces: the marketing
site at `/` and the browser editor at `/app/`. `vercel.json` declares the
contract; `scripts/build-vercel.mjs` produces the artifact;
`scripts/verify-vercel-routes.mjs` checks the deployed origin actually behaves
the way the contract says.

## The build

| Setting           | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| `installCommand`  | `pnpm install --frozen-lockfile --store-dir node_modules/.pnpm-store` |
| `buildCommand`    | `node scripts/build-vercel.mjs`                                       |
| `outputDirectory` | `dist`                                                                |

The install is a full workspace install, not a filtered one, because both
`@arq/marketing` and `@arq/web` are built and the editor reaches into the
shared packages.

The pnpm store is pinned inside `node_modules` rather than left at pnpm's
global default. Vercel restores `node_modules` from its build cache but treats
the global store as a separate directory, so a cached `node_modules` could
reference store entries that were not restored alongside it. The marketing
build reads that store — `check-dependency-licences.mjs` shells out to
`pnpm licenses list --json` to write the SBOM — and failed with
`ERR_PNPM_MISSING_PACKAGE_INDEX_FILE` on the second and later deployments while
the first, uncached one succeeded. Keeping the store inside `node_modules` makes
the two cache or miss together. `build-vercel.mjs` exports the same path as
`npm_config_store_dir` so every nested pnpm agrees with the install.

`build-vercel.mjs` runs the same gates the Pages workflow runs — the language
verify, the route-coverage verify, the rendered public-copy audit, the
commit-bound proof — then builds the editor with `--base=/app/` and asserts the
four artifacts that must exist (`index.html`, `404.html`, the site proof, and
the editor shell) before assembling `dist/`. A missing artifact is a build
failure, not a quietly thinner deployment.

`buildCommand` is a script rather than an inline string partly because
`vercel.json` caps it at 256 characters, but mainly because the environment
juggling below needs explaining and a JSON string is a bad place to explain
anything.

## Why the two hosts differ in exactly two inputs

`SITE_BASE_PATH` is empty here. GitHub Pages serves this site from the `/Arq`
project subpath, so `.github/workflows/deploy-pages.yml` sets
`SITE_BASE_PATH=/Arq` and every internal URL is prefixed. Vercel serves from the
domain root, so the same prefix would make every asset 404. Neither value may be
hardcoded in the build. `vercel.json` redirects `/Arq` and `/Arq/:path*`
permanently to the root equivalents, so links published against the Pages URL
keep resolving.

`SITE_ORIGIN` prefers an explicit override, then
`VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`. Canonical URLs on a
production deployment therefore name the stable domain rather than that
deployment's unique hostname, while a preview still names its own hostname —
which is correct, because a preview must not claim to be canonical for the
production URL.

Everything else is the same build contract, which is what makes a green Vercel
build evidence about the same product Pages publishes, and keeps the two hosts a
rollback pair rather than diverging deployments.

## Routing, caching and headers

`/app` and `/app/:path*` rewrite to `/app/index.html` so deep editor routes fall
back to the shell instead of 404ing.

Three cache tiers, split by whether the filename carries a content hash:

| Path            | `Cache-Control`                         |
| --------------- | --------------------------------------- |
| `/app/assets/*` | `public, max-age=31536000, immutable`   |
| `/assets/*`     | `public, max-age=3600, must-revalidate` |
| everything else | `public, max-age=0, must-revalidate`    |

Only the editor's Vite-hashed assets are immutable. The marketing site's
`/assets/` filenames are not hashed, so marking them immutable would pin a stale
file in every visitor's cache with no way to invalidate it.

Every response carries `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` and
a `Permissions-Policy` that denies camera, microphone, geolocation, payment, USB
and interest-cohort.

## Binding a release to an approved revision

A hosted build clones a _branch_, not a commit. Between the moment a release is
approved at some revision and the moment Vercel checks out, the branch can move.
Nothing downstream notices: the deployment reaches READY either way, the site
looks right, and the revision recorded in the proof comes from the same drifted
checkout, so it agrees with itself and confirms nothing.

The expectation therefore has to arrive from outside the checkout. Set
`EXPECTED_SOURCE_SHA` as a Vercel project environment variable on the
environment that carries approved releases; `build-vercel.mjs` compares it
against the checked-out revision before any build step runs and fails on
mismatch.

Absence is not a failure, and deliberately so. A preview builds whatever its
branch points at, so there is no independent expectation to check it against and
demanding one would produce a check that always passes. Leave the variable unset
on previews; set it on production and a drifted branch stops the deployment
instead of shipping a revision nobody approved.
`.github/workflows/deploy-pages.yml` binds the same way through
`scripts/write-deployment-provenance.mjs`, so both hosts hold the published
artifact to one rule rather than two.

The outcome is recorded, not just enforced: `deployment-source.json` and the
`vercelDeployment` block inside the site proof both carry `expectedCommit` and
`sourcePinned`, so a reader of the deployed artifact can tell an approved
release from a preview that was free to build whatever it found.

## Verifying

Reproduce what Vercel runs, supplying the variables it would:

```
VERCEL_URL=preview.example.invalid VERCEL_GIT_COMMIT_SHA=$(git rev-parse HEAD) \
  node scripts/build-vercel.mjs
```

Then confirm the two things that differ from the Pages build: no asset path
begins with `/Arq`, and every route carries a canonical URL on the host being
deployed to.

A green build proves the artifact was produced. It proves nothing about how the
origin serves it, so `.github/workflows/verify-deployment-routes.yml` runs
`scripts/verify-vercel-routes.mjs` against the actual preview on every pull
request that touches the deployment inputs. That job resolves the origin from
the GitHub deployment Vercel records, waits for the origin to serve _this_
commit before asserting anything — a branch alias points at whatever deployed
most recently, so checking straight away can pass against the previous
deployment — and then checks that `/app/` answers, deep editor routes fall back
to the shell, `/Arq/...` still redirects, an unknown path is a branded 404 with a
404 status, and the cache split does not mark unhashed assets immutable.

To point it at any origin by hand:

```
node scripts/verify-vercel-routes.mjs --base-url https://<origin> --expected-commit $(git rev-parse HEAD)
```

If the project has deployment protection on, set
`VERCEL_AUTOMATION_BYPASS_SECRET` (or pass `--bypass-token`) so a protected
preview can be read without turning protection off for everyone. An unreadable
protected origin is reported as not inspected, never as a pass.

Three behaviours worth re-checking after any change here, because each fails
silently rather than loudly:

| Given                                                     | Expect                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_URL` both set | canonical uses the production domain, not the deployment hostname |
| `EXPECTED_SOURCE_SHA` set to a different revision         | the build fails before any build step runs                        |
| `EXPECTED_SOURCE_SHA` unset                               | the build proceeds, and records `sourcePinned: false`             |

## What this is not

Vercel is not yet the production host. GitHub Pages remains the published site
through `.github/workflows/deploy-pages.yml`. Making Vercel production is a
separate decision with its own record.

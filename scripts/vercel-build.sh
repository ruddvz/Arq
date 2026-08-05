#!/usr/bin/env bash
# Vercel's build step for the public marketing site.
#
# This lives in a script rather than inline in vercel.json for two reasons. The
# obvious one is that vercel.json caps buildCommand at 256 characters and the
# inline version was 265. The better one is that the environment juggling below
# needs explaining, and a JSON string is a bad place to explain anything.
set -euo pipefail

# Empty on purpose, and the single most breakable line here.
#
# GitHub Pages serves this site from https://ruddvz.github.io/Arq/, so the Pages
# workflow sets SITE_BASE_PATH=/Arq and every internal URL is prefixed at build
# time. Vercel serves from the domain root. Carrying the Pages prefix here would
# make every asset and link resolve one directory too deep and 404 the entire
# site, while the build itself reported success. Neither value can be a default
# baked into the build: each host has to state its own.
export SITE_BASE_PATH=""

# Prefer the stable production domain over this deployment's unique hostname, so
# a production build emits canonical URLs pointing at the domain users actually
# visit. A preview falls back to its own hostname, which is correct: a preview
# must not declare itself canonical for the production URL and invite a search
# engine to index it there.
export SITE_ORIGIN="https://${VERCEL_PROJECT_PRODUCTION_URL:-${VERCEL_URL:-localhost}}"

# The revision the footer attributes the build to. Vercel supplies the commit it
# checked out; git is not guaranteed to be usable in the build container.
export SITE_REVISION="${VERCEL_GIT_COMMIT_SHA:-unknown}"

pnpm --filter @arq/marketing build

# Writes arq-deployment-provenance.json into the output: both SHAs, toolchain,
# and a hash per route and per file.
#
# --allow-unpinned governs only the case where no expected revision was supplied
# at all. If EXPECTED_SOURCE_SHA is set as a Vercel environment variable, the
# comparison still runs and a mismatch still fails this build, flag or not. A
# preview builds whatever its branch points at, so requiring an expectation
# there would only produce a check that always passes; a production release is
# approved at a specific revision, which is where the variable belongs.
node scripts/write-deployment-provenance.mjs \
  --dist apps/marketing/dist \
  --target vercel \
  --allow-unpinned

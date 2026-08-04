# ARQ Language System 4.1 integration and reconciliation brief

## Mission

Make language a verified product boundary. The goal is one accurate meaning for
each ARQ object, state, action, permission, file condition, capability,
limitation and consequence across product UI, public site, docs, support,
accessibility, localisation and product AI.

This package does not replace repository authority. It makes source drift,
missing state translation and unsupported public claims fail visibly.

## Required reading order

1. accepted, non-superseded ADRs relevant to the change;
2. working code and tests for claims about current behaviour;
3. blueprint and release scope for product direction;
4. registry/state/RBAC/format sources for canonical names and boundaries;
5. status as a cross-checked summary; and
6. this language system.

## Pre-integration blockers

Do not activate the support/AI context until these are resolved or deliberately
retained as conflicts:

1. **3D status conflict:** `STATUS.md` contains both a wired 3D view statement
   and a no-consumer statement. Correct the stale source, run relevant evidence,
   then refresh context.
2. **Persistence decision:** current demo-plan IndexedDB journalling is distinct
   from the intended portable `.arq` path. Resolve the ADR overlap before saying
   "saved locally" without a target.
3. **Public reachability drift:** correct present-tense `.arq` opening,
   import/export, semantic tool, AI, hardware and privacy assertions listed in
   `00-audit/PUBLIC-COPY-RECONCILIATION.md`.

## Installation and activation

1. Run `node 03-machine-layer/verify-install-map.mjs` in this package.
2. Copy/merge using `04-wiring/install-map.json` on a dedicated ARQ branch.
3. Merge `package-scripts.fragment.json` and `ci-fragment.yml` into the real
   repository without replacing unrelated scripts or CI jobs.
4. Add the rendered-site fragment to the public-site tests and bind each public
   current assertion to a claim record. Classify every public content file in
   the public-copy inventory, then reconcile the inventory with the route map
   and typed page registry.
5. Merge the Pages deployment fragment. Build a route-hash proof into the
   deploy artifact and make post-deploy verification a required result.
6. Run installation, public-copy and editorial-policy verification. Then run
   source contract verification and refresh context once after canonical
   source correction.
7. Commit the generated context, review its source digest and run all gates.

## Mandatory command order in the integrated repository

```bash
pnpm arq:language:sources:verify
pnpm arq:language:install:verify
pnpm arq:language:public:verify
pnpm arq:language:routes:verify
pnpm arq:language:context:verify
pnpm arq:language:data:verify
pnpm arq:language:editorial:verify
pnpm arq:language:state:verify
pnpm arq:language:adapters:verify
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

CI must never run `arq:language:refresh` before `context:verify`. Refreshing
first self-heals evidence drift and hides the exact problem this system exists to
catch.

## Definition of done

- source context is fresh and contains all required source sets;
- every registry and implementation-visible state has a language or adapter map;
- every current public claim is bound to fresh evidence;
- every public content source is classified and has an owner/review trigger;
- every public source, route-map record, typed page registry entry and static
  output route is reconciled;
- public copy is reviewed for specificity and evidence, not detector scores or
  inferred authorship;
- public and UI copy contain no U+2014;
- the deployed Pages proof commit and route hashes match the audited artifact;
- no active conflict is rendered as a settled current claim;
- compatibility, opening, journal save, portable-file publication and sync are
  distinguishable in UI and support;
- recovery states state source, scope, safe boundary and next action;
- imports/exports state fidelity rather than implying lossless exchange;
- permission copy names role, action and capability boundary;
- AI proposals retain revision, assumptions, validation, approval and undo;
- consumer contexts declare a compatible contract version;
- rendered-site, core product, type, build and relevant Rust/browser checks pass.

## Handoff report

The implementation handoff must list:

1. resolved and unresolved conflicts;
2. source digest and changed source sets;
3. changed canonical terms, message IDs and state adapters;
4. claim-state transitions and public bindings;
5. UI, marketing, docs, support and AI updates;
6. gates added and their outputs; and
7. remaining facts that need an engineering decision rather than copy.

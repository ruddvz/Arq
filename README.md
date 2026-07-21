# Arq

Arq is a precise, open, and approachable architectural workspace: a browser-based
plan and lightweight BIM editor for independent architects and small practices,
built around a real semantic building model rather than disconnected lines.

**Status: planning and technical-validation phase.** No product code has shipped
yet — this repo currently holds the complete plan, the design system, schemas, a
starter monorepo, and a static prototype.

## Start here

**[`docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md`](docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md)**
is the current source of truth. Source-of-truth order when documents disagree:

1. Approved ADRs (`docs/adr/`)
2. The complete blueprint (above)
3. Page, component, API, schema, and package specifications (`docs/pages/`,
   `docs/components/`, `api/`, `database/`, `contracts/`)
4. Machine-readable registers (`backlog/`, `quality/`, `validation/`)
5. Historical planning documents (`docs/history/`)

## First product

A desktop-class browser editor where an architect can create or trace a small
residential floor plan, author semantic walls/doors/windows/rooms, inspect and edit
their properties, see coordinated 2D and 3D, add dimensions, recover after an
interruption, download an Arq project archive, and export a scaled vector PDF.

## Begin in this order

1. Repository ownership, visibility, and licence decision — **resolved**: proprietary
   / all rights reserved, see `LICENSE`.
2. ADR review (`docs/adr/`)
3. Architect interviews (`docs/research/`)
4. Clickable prototype tests (`prototype/`)
5. 2D renderer benchmark
6. Local journal and recovery spike
7. Wall-room-plan-3D vertical slice
8. Documentation and PDF export
9. Reliability gate
10. Exchange, review collaboration, AI, and native iPad later

## Key directories

- `docs/product/` — the blueprint, requirements, release scope, feature matrix
- `docs/adr/` — 18 accepted architecture decisions + template
- `docs/architecture/`, `docs/schemas/` — technical architecture and data schemas
- `docs/pages/`, `docs/components/`, `docs/flows/` — every currently specified page,
  interface component, and end-to-end flow
- `docs/research/`, `docs/history/` — interview materials and superseded earlier drafts
- `design/` — design tokens (CSS/JSON/TS) and 40 draft technical SVG icons
- `api/` — OpenAPI spec and event catalogue drafts
- `database/` — PostgreSQL schema, ERD, data dictionary
- `contracts/` — shared TypeScript type contracts (model, operations, renderer, storage)
- `prototype/` — an openable static product-shell prototype (`prototype/index.html`)
- `apps/`, `packages/`, `workers/` — the pnpm/turborepo workspace (see
  `docs/architecture/REPOSITORY-STRUCTURE.md`)
- `backlog/` — ordered issue backlog, epics, milestones
- `quality/` — anticipated bugs, edge cases, QA test cases, improvement register
- `validation/` — decisions that still require real evidence (not guessed)
- `legal/`, `business/`, `operations/`, `security/` — supporting non-engineering work

## Workspace

```
pnpm install
pnpm typecheck   # runs via turbo across every package/app/worker
pnpm format:check
```

See `CONTRIBUTING.md` for the backlog-driven pull request workflow.

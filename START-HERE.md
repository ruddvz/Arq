# Start here

## What this repository is

Arq began as a specification pack and is now a working monorepo: 30 packages,
three apps (`apps/web` workspace, `apps/marketing` public site, `apps/api`
stub), workers, a Rust core, CI gates and a large test suite, alongside the
full planning corpus the implementation is built from. `STATUS.md` is the
current-state summary; `README.md` is the project introduction.

## Plan of record

1. `docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md` - the blueprint
2. `docs/adr/` - accepted decisions; live decisions outrank older text
3. `backlog/` - the 242 ordered issues (`node scripts/generate-backlog-index.mjs`
   regenerates the index from the issue files)
4. `docs/product/RELEASE-SCOPE.md` - what each release contains

## First product

Build a desktop-class browser editor that lets an architect create or trace a small
residential floor plan, author semantic walls, doors, windows and rooms, inspect and
edit properties, see coordinated 2D and 3D, add dimensions, recover after interruption,
download an Arq archive and export a scaled vector PDF.

## Key directories

- `apps/` - the workspace, the public website, the API stub
- `packages/` - implemented libraries (file format, geometry, renderers, tools, UI)
- `docs/pages/` and `docs/components/` - all identified surfaces and components
- `docs/flows/` - end-to-end flows
- `prototype/` - the original static product-shell prototype (historical)
- `quality/` and `validation/` - bug/test/edge-case registers and evidence-pending decisions
- `legal/` and `operations/` - outlines awaiting professional review
- `remaining/` - work that still cannot be closed from inside this repository

# Arq

Arq is an early-stage effort to build a modern architectural design and BIM
authoring platform — the ground AutoCAD (2D/3D drafting) and Revit (BIM) cover today,
rethought around a semantic building model, transparent AI-assisted authoring, and
real-time collaboration.

**Status: planning phase.** Nothing is built yet.

## Start here

**[`docs/product/ARQ-MASTER-PRODUCT-PLAN-v0.1.md`](docs/product/ARQ-MASTER-PRODUCT-PLAN-v0.1.md)**
is the current source of truth: product vision and principles, research-backed
requirements, target users, full MVP scope and non-goals, platform strategy
(**web-first**, with native iPad/macOS/Windows shells layered on afterward), visual
design system, AI architecture (`ArqScript`), data model, technical architecture,
open-source licensing policy, performance/reliability/security plans, testing
strategy, milestone roadmap, initial epics and issues, governance, risks, go/no-go
gates, and immediate next actions.

## Earlier drafts

The docs below were the first pass at this planning work and are kept for history.
Each has been superseded by a section of the master plan above (see the banner at the
top of each file for exactly where):

- [`docs/RESEARCH.md`](docs/RESEARCH.md) — initial notes on six open-source projects
  (FreeCAD, OpenSCAD, LibreCAD, GenCAD, CAD Skills/text-to-cad, RevitLookup).
- [`docs/PAIN_POINTS.md`](docs/PAIN_POINTS.md) — initial survey of architect
  complaints about Revit/AutoCAD/ArchiCAD/SketchUp.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — initial technical direction
  (Python/OpenCASCADE-based, since revised to TypeScript/web/OpenCascade.js).
- [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md) — initial product/platform plan
  (recommended iOS-native first, since revised to web-first).
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — initial visual direction
  (Phosphor-based icons, since revised to Lucide-based).

## Next steps

See the master plan's own §32 "Immediate next actions" and §33 "Questions to resolve
through research, not guesswork" — those are the next decisions and work items, not
duplicated here.

# Arq

Arq is an early-stage effort to build a native, Apple-first BIM authoring platform for
architectural and building design — the ground AutoCAD (2D/3D drafting) and Revit
(BIM) cover today, rethought around on-device LiDAR capture, AI-assisted authoring,
and real-time collaboration.

**Status: planning phase.** Nothing is built yet. This repo currently holds the
groundwork: a survey of relevant open-source projects, a survey of what architects
actually complain about in the incumbent tools, a proposed technical architecture, a
product/platform plan, and a visual design direction. See **What's here** below.

## Why

Two established categories dominate building design software:

- **AutoCAD-style 2D/3D drafting** — precise geometric drawing, not aware of what a
  wall or door *means*.
- **Revit-style BIM** — a parametric, object-aware model of a building (walls, doors,
  rooms) that all views and schedules derive from.

Both are closed-source, expensive, and heavy. Meanwhile, AI-driven "text/image to CAD"
generation is a new capability that neither category has natively. Arq's working thesis
is that there's room for an open platform that combines:

1. A real BIM-like data model (parametric building elements, not just lines/arcs).
2. A solid geometry kernel for precise 3D output (STEP/IFC-compatible).
3. AI-assisted authoring — natural language / sketch → building geometry — as a
   first-class input method, not a bolt-on.

## What's here

- [`docs/RESEARCH.md`](docs/RESEARCH.md) — notes on six existing open-source projects
  (FreeCAD, OpenSCAD, LibreCAD, GenCAD, CAD Skills/text-to-cad, RevitLookup) and what
  each teaches us about building Arq.
- [`docs/PAIN_POINTS.md`](docs/PAIN_POINTS.md) — what architects actually complain
  about in Revit/AutoCAD/ArchiCAD/SketchUp (cost, no Mac support, learning curve,
  brittle parametrics, collaboration friction, the field/office capture gap, and
  more), each mapped to an Arq response.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the technical direction: BIM data
  model, geometry kernel choice (OpenCASCADE), AI operation layer, and a phased
  build-out plan.
- [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md) — who we build for first, why
  **iOS/iPadOS first** (with a lightweight companion website, then macOS, then
  Windows), the full feature plan by tier, and the roadmap.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — the visual direction: monochrome
  UI (color reserved only for the model itself and for error states), Plus Jakarta
  Sans typography, a Phosphor-based custom icon system, spacing/motion principles.

## Next steps

The plan is deliberately sequenced: research → pain points → architecture → product
plan → design system, each building on the last. `docs/PRODUCT_PLAN.md` ends with the
open risks and business-model decisions that still need a call before Phase 1
implementation starts; `docs/DESIGN_SYSTEM.md` ends with the few visual details that
need real screens (not just description) to settle.

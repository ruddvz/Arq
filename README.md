# Arq

Arq is an early-stage effort to build an open, modern platform for architectural and
building design — the kind of ground AutoCAD (2D/3D drafting), Revit (BIM), and
parametric CAD tools cover today, rethought around AI-assisted workflows.

**Status: research / concept phase.** Nothing is built yet. This repo currently holds
the groundwork: a survey of relevant open-source projects and a proposed architecture
to start from. See [`docs/RESEARCH.md`](docs/RESEARCH.md) and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

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
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — a proposed direction: data model,
  geometry kernel choice, and a phased build-out plan.

## Next steps

This is intentionally scoped as research first, because "AutoCAD/Revit but new" is a
multi-year undertaking and the highest-leverage early decision is *what not to build*.
See the recommendation and open questions at the end of `docs/ARCHITECTURE.md`.

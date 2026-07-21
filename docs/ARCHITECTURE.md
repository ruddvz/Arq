# Proposed architecture direction

> **Superseded.** [`docs/product/ARQ-MASTER-PRODUCT-PLAN-v0.1.md`](product/ARQ-MASTER-PRODUCT-PLAN-v0.1.md)
> §16 defines the current technical architecture (TypeScript/React/web-first with
> OpenCascade.js in a Worker, rather than the Python/pythonocc-core direction below)
> and §19 adds a licensing policy this draft didn't cover. Kept here as an earlier
> draft for history.

This is a starting recommendation, not a locked decision — the point is to give the
next round of work a concrete thing to react to instead of a blank page. See
[`RESEARCH.md`](RESEARCH.md) for the source material behind each choice.

## Scope reality check

"Build something like AutoCAD and Revit" is a multi-year, large-team undertaking in its
full form (both products have 25+ years of engineering behind them). The only way this
is tractable to start is to pick a thin, real vertical slice and defer everything else.
Recommended slice for a first milestone:

> Author a simple building's walls, floors, and openings parametrically, in 3D, and
> export it to IFC — optionally starting from a natural-language description.

That slice touches all four architectural layers below without requiring a full
drafting suite, rendering engine, or scheduling/quantity-takeoff features (all of which
real Revit has and a v1 doesn't need).

## Proposed layers

1. **Geometry kernel: OpenCASCADE**, accessed via `pythonocc-core` (Python) or
   `build123d` (higher-level Python API over OpenCASCADE, as used by CAD Skills). This
   avoids writing a B-rep/NURBS kernel and gets STEP import/export for free. FreeCAD
   and GenCAD both validate this choice independently.
   - Alternative considered: write a from-scratch mesh-based (not B-rep) engine for
     simplicity. Rejected — precise architectural geometry (accurate wall joins,
     boolean openings, IFC export) needs real solid modeling, not meshes.

2. **BIM data model (the differentiated part):** a parametric object model on top of
   the kernel — `Wall`, `Slab`, `Opening`, `Space`, etc., each with parameters
   (thickness, height, material) and relationships (a wall hosts a door opening). This
   is the piece none of the surveyed general-CAD projects (FreeCAD excepted, partially)
   provide out of the box, and it's what makes the platform "Revit-like" rather than
   just "CAD." Target IFC as the schema to align with, so entities map cleanly to
   IFC export.

3. **AI authoring layer:** natural language (and later, sketch/image per GenCAD) → a
   sequence of calls against a small, fixed "building operations" vocabulary (e.g.
   `add_wall(start, end, height, thickness)`, `cut_opening(wall, type, position)`) —
   not raw geometry generation. This mirrors the CAD Skills pattern of exposing CAD as
   agent-callable operations. Concretely, this can start as an MCP-style skills/tools
   layer over the BIM object model, which also means an AI agent (like the one used to
   build this repo) could author buildings the same way it authors code.

4. **Interop:** DXF/DWG import for 2D plan interchange (pattern: LibreCAD's
   `libdxfrw`), IFC/STEP import-export for 3D BIM interchange (pattern: FreeCAD). Treat
   both as required for the platform to be usable alongside existing AutoCAD/Revit
   workflows, not optional extras.

5. **UI/viewer:** deliberately not committing to a stack yet — a native Qt desktop app
   (like all four C++ projects surveyed) and a web-based viewer (e.g. three.js/WebGL
   rendering STEP/glTF output) are both viable, and the choice mostly depends on
   whether Arq should be a desktop tool or a web platform. This should be an explicit
   decision, not a default (see below).

## Suggested phased build-out

| Phase | Deliverable |
|---|---|
| 0 (this PR) | Research + architecture direction (done) |
| 1 | Kernel + BIM object model: define `Wall`/`Slab`/`Opening` as Python classes over `build123d`/OpenCASCADE; script-only, no UI |
| 2 | IFC export of a hand-scripted simple building; validate in an existing IFC viewer |
| 3 | AI operations layer: natural-language → operation sequence → geometry, for a constrained vocabulary (walls + openings only) |
| 4 | Minimal viewer (web or desktop — decide in phase 1) to visualize output without leaving the terminal/agent loop |
| 5+ | DXF/DWG import, rooms/spaces, roofs, more element types, multi-user/versioning — deferred until 1-4 prove the core loop works |

## Open questions for the next decision point

These need a person to decide, not research to resolve:

- **Desktop app vs. web platform?** Determines UI stack entirely and is hard to
  reverse later.
- **Full local app (like FreeCAD) vs. cloud service with a thin client?** Affects
  whether this is a downloadable tool or a hosted product.
- **How central is the AI-authoring path vs. traditional manual drafting?** If AI
  generation is the primary interface (not just a convenience feature), the BIM object
  model and operation vocabulary should be designed API-first, with any GUI as a
  secondary consumer of that API — the reverse of how FreeCAD/LibreCAD are structured.
- **License:** OpenCASCADE is LGPL; CGAL (OpenSCAD's engine) has license terms that
  differ by use case. If Arq is closed-source or has commercial ambitions, licensing
  of the chosen kernel needs a deliberate check before committing to it in phase 1.

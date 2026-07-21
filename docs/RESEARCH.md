# Reference project research

Six open-source projects were surveyed as inputs for Arq. They cluster into three
groups: **general CAD kernels/apps** (FreeCAD, OpenSCAD, LibreCAD), **AI-assisted CAD
generation** (GenCAD, CAD Skills / text-to-cad), and **BIM tooling** (RevitLookup). None
of them is "Revit for the open web," but each covers a piece of the problem.

## 1. FreeCAD — parametric 3D CAD kernel + BIM workbench

- **Repo:** https://github.com/FreeCAD/FreeCAD
- **License:** LGPL-2.1
- **Stack:** C++ (54%) core, Python (44%) scripting/UI logic, Qt for UI, **OpenCASCADE**
  as the geometry kernel, Coin3D (Open Inventor) for the 3D scenegraph.
- **Architecture:** A document/object model where every feature is a parametric object
  with editable parameters, organized into pluggable **workbenches** — Part Design,
  Sketcher, **BIM/Arch**, FEM, CAM, etc. The BIM workbench already models architectural
  concepts (walls, IFC import/export) on top of the same parametric core used for
  mechanical parts.
- **Relevance to Arq:** This is the closest existing thing to "open-source Revit + CAD
  kernel" already merged into one project. Its BIM workbench and IFC support are worth
  studying directly — it may be more effective to build Arq's early geometry/BIM
  authoring on top of OpenCASCADE (as FreeCAD does) than to write a kernel from
  scratch. FreeCAD's Python API is also a plausible integration point for AI-driven
  generation instead of building a new kernel binding.

## 2. OpenSCAD — programmatic/parametric solid modeling

- **Repo:** https://github.com/openscad/openscad
- **License:** GPL
- **Stack:** C++17, Qt (UI), **CGAL** (exact geometry algorithms), OpenGL/GLEW
  (rendering), Boost/GMP/MPFR (math).
- **Architecture:** "Script, don't drag" — a small declarative language compiles to a
  CSG tree (union/difference/intersection of primitives and extrusions), which is
  evaluated into a mesh. No interactive dragging of geometry; the script *is* the
  parametric model.
- **Relevance to Arq:** This is the strongest existing proof that a declarative,
  code-like description of geometry is both usable and precise — which matters a lot
  if Arq wants AI models to *generate* building geometry, because generating a script
  or IR is far more tractable for an LLM than generating raw mesh/B-rep data directly.
  OpenSCAD's language design (and its limitations — no undo-friendly interactive
  editing, steep learning curve for non-programmers) is a useful case study for
  designing an intermediate representation that an AI layer emits and a human can still
  read and hand-edit.

## 3. LibreCAD — 2D drafting

- **Repo:** https://github.com/LibreCAD/LibreCAD
- **License:** GPLv2
- **Stack:** C++ (82%), Qt, `libdxfrw` for DXF/DWG read/write.
- **Architecture:** Classic 2D drafting app (lines, arcs, splines, dimensions) with
  DXF/DWG import/export and PDF/SVG export. Originated as a fork of QCAD's open
  edition.
- **Relevance to Arq:** Directly analogous to AutoCAD's core 2D drafting workflow.
  Most real-world architectural handoff still happens as DXF/DWG plans, so DXF/DWG
  import-export compatibility (which LibreCAD's `libdxfrw` already solves) is a
  near-mandatory interop requirement for Arq if it wants to exchange drawings with
  existing AutoCAD-based workflows, rather than a nice-to-have.

## 4. GenCAD — image-to-CAD generation (research)

- **Repo:** https://github.com/ferdous-alam/GenCAD
- **License:** open (research code, 3.6k★/449 forks)
- **Stack:** Python 3.10, PyTorch, `pythonocc-core` (Python bindings to OpenCASCADE),
  Docker.
- **Architecture:** A generative pipeline — contrastive sketch representation (CSR) +
  cross-modal contrastive image-CAD pairing (CCIP) + a diffusion prior — that turns a
  2D image/sketch into a parametric CAD sequence.
- **Relevance to Arq:** This is a concrete existing recipe for "sketch/image →
  parametric CAD," which is one of the two AI-input modalities Arq is interested in
  (the other being natural-language text). It's research-grade, not
  production-ready, but it validates that `pythonocc-core` (OpenCASCADE again) is a
  workable substrate for ML-generated CAD, reinforcing OpenCASCADE as the likely
  geometry kernel choice across three of the six projects surveyed here.

## 5. CAD Skills (`earthtojake/text-to-cad`) — text-to-CAD agent skills library

- **Repo:** https://github.com/earthtojake/text-to-cad (linked twice in the source
  list; one project)
- **License:** MIT
- **Stack:** JS (62%) + Python (37%), **Build123d** + OpenCASCADE as the CAD engine.
- **Architecture:** Not a standalone app — a *skills library* for AI coding agents
  (Claude, Codex, etc.) that exposes CAD, DXF, URDF/SRDF/SDF (robot + simulation
  description), G-code, and fabrication-vendor (SendCutSend, Bambu Labs) skills, so an
  agent can go from a text prompt to a STEP/STL/GLB file and, for robotics, all the way
  to a fabrication or slicing pipeline.
- **Relevance to Arq:** This is the most directly applicable reference for the "text →
  building geometry" half of Arq's thesis, and it's the freshest/most active of the
  six (9k★, active Discord). It demonstrates the pattern Arq should likely copy for
  its own AI layer: don't have the AI model emit raw geometry — have it call a small
  set of well-defined CAD *operations* (build a wall, cut an opening, extrude a
  footprint) against a kernel, mirroring how build123d wraps OpenCASCADE. Note it's
  general fabrication/robotics-focused, not architecture-specific — Arq would need its
  own "skill set" for building elements (walls, floors, roofs, IFC-style entities)
  rather than reusing this one wholesale.

## 6. RevitLookup — Revit/BIM introspection tool

- **Repo:** https://github.com/lookup-foundation/RevitLookup
- **License:** MIT
- **Stack:** C# / .NET, distributed as a Revit add-in (WinGet, AppBundle, MSI).
- **Architecture:** Not a CAD/BIM authoring tool itself — it's a developer utility that
  attaches to a running Revit session and lets you inspect any element's live
  parameters, properties, and object relationships (the BIM equivalent of a debugger /
  object inspector).
- **Relevance to Arq:** Useful less as code to reuse (it's tied to Revit's proprietary
  API) and more as a **reference for what a BIM data model needs to expose**. If Arq
  builds its own BIM object model, an equivalent "inspector" tool (browse any building
  element's parameters/relationships live) is worth planning for early — it was
  valuable enough to Revit's own ecosystem that it has 1.4k★ as third-party tooling,
  which suggests Revit's own built-in introspection is insufficient and Arq shouldn't
  repeat that gap.

## Cross-cutting takeaways

1. **OpenCASCADE shows up in three of six projects** (FreeCAD, GenCAD, CAD Skills) as
   the underlying geometry kernel. Writing a new B-rep/NURBS kernel from scratch is not
   a reasonable use of effort this project should take on — OpenCASCADE (via FreeCAD's
   C++ integration or `pythonocc-core`/build123d's Python bindings) is the pragmatic
   starting point for real 3D geometry.
2. **AI-to-CAD generation works best through an operation/skill layer, not raw
   geometry.** Both GenCAD and CAD Skills generate a *sequence of parametric
   operations* rather than raw meshes or point clouds. Arq's AI input path should
   follow the same pattern: define a small "building operations" vocabulary (walls,
   openings, slabs, roofs) and have AI models target that, not raw B-rep.
3. **File format interop is a hard requirement, not a feature.** DXF/DWG (LibreCAD) and
   IFC/STEP (FreeCAD, GenCAD) are the formats the existing AutoCAD/Revit ecosystem
   already uses. Arq needs at least import/export on these from day one or it can't
   participate in real projects.
4. **A real BIM object model (walls/doors/rooms as objects, not just geometry) is what
   separates "CAD" from "Revit-like."** None of FreeCAD/OpenSCAD/LibreCAD do this by
   default — FreeCAD's Arch/BIM workbench is the closest. This is the biggest
   differentiated piece of work Arq would need to build, not adapt from elsewhere.

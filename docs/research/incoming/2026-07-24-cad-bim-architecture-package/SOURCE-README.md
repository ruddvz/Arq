# Arq CAD/BIM Engineering Architecture Package

This package turns both supplied Arq blueprints into one corrected, implementation-ready contract for a browser-native CAD/BIM product.

Start with [ARQ_MASTER_TECHNICAL_SPECIFICATION.md](ARQ_MASTER_TECHNICAL_SPECIFICATION.md). It retains the product vision, contextual UX, local-first collaboration, precision rendering, rules engine, and WebGPU direction while correcting unsafe assumptions in the raw blueprints.

## Package map

| File | Use it for |
| --- | --- |
| [ARQ_MASTER_TECHNICAL_SPECIFICATION.md](ARQ_MASTER_TECHNICAL_SPECIFICATION.md) | The integrated product, platform, UI/UX, collaboration, precision, rule-engine, and roadmap specification |
| [ARQ_ULTIMATE_MASTER_SPECIFICATION.md](ARQ_ULTIMATE_MASTER_SPECIFICATION.md) | Consolidated product experience direction for non-modal work, inspect-through selection, ghost options, and progressive platform delivery |
| [ARQ_IMPLEMENTATION_DEEP_DIVE.md](ARQ_IMPLEMENTATION_DEEP_DIVE.md) | Corrected implementation contract for GPU selection, deferred CSG, desktop shell boundaries, and accessible contextual UI |
| [ARQ_UI_UX_SYSTEM_SPECIFICATION.md](ARQ_UI_UX_SYSTEM_SPECIFICATION.md) | Corrected interaction and visual-system contract for HUDs, quantity entry, scrubbers, command palette, diagnostics, motion, and progressive glass surfaces |
| [ARQ_CAD_BIM_ENGINEERING_GUIDE.md](ARQ_CAD_BIM_ENGINEERING_GUIDE.md) | The canonical technical direction and decision rationale |
| [ARCHITECTURE_AUDIT_AND_CORRECTIONS.md](ARCHITECTURE_AUDIT_AND_CORRECTIONS.md) | A direct review of the supplied material, including bugs and misleading assumptions |
| [IMPLEMENTATION_BACKLOG.md](IMPLEMENTATION_BACKLOG.md) | Ordered engineering work with acceptance criteria |
| [KERNEL_EVALUATION_PLAN.md](KERNEL_EVALUATION_PLAN.md) | How to choose and validate a geometry kernel before committing |
| [decision_records/](decision_records/) | Short, durable architectural decision records, including contextual interaction and progressive visual-system decisions |
| [reference/](reference/) | Tested contracts for dependency propagation, snapping, coordinates, worker messages, render origins, collaboration operations, rule packs, selection, deferred CSG, desktop capabilities, quantity drafts, UI placement, scrubbing, commands, diagnostics, and surface tokens |

## Core decisions in one page

1. The source of truth is a versioned semantic building model in double precision, not a Three.js scene and not a raw B-Rep handle.
2. Derived geometry, tessellation, render buffers, spatial indexes, selection IDs, and thumbnails are disposable caches.
3. Use a serial authoritative model worker with transaction revisions. Use a bounded geometry worker pool only for cancellable heavy jobs.
4. Keep directed derivation dependencies separate from relational BIM graphs and from algebraic dimensional constraints.
5. Start as a deterministic 2D/2.5D architectural modeller. Add a B-Rep capability behind an adapter after a measured kernel spike proves it.
6. Treat IFC as a semantic interchange contract, DXF as scoped 2D interchange, and DWG as a separately licensed capability. Do not promise general DWG fidelity.
7. Make SharedArrayBuffer and WebAssembly threads an optimisation path, never a functional requirement.
8. Use CRDTs to converge semantic operations, then rebuild and validate BIM state. Do not merge raw geometry.
9. Make building-code checks versioned, jurisdiction-scoped rule packs with sources and review states, not global constants.
10. Default to one-layer semantic picking. Make depth peeling an explicit, capped inspect-through action with revision-matched draw-ID resolution.
11. Treat direct manipulation as provisional until one validated semantic transaction commits. Derived geometry results must match the committed revision and input signature.
12. Treat Tauri as an optional WebView desktop shell. A direct native renderer is a separate decision, not an implied side effect.
13. Route HUD, scrubber, palette, inspector, shortcut, and diagnostic edits through typed semantic proposals. Motion previews are never canonical mutations.
14. Treat blur, squircle corners, and spring motion as progressive enhancements with keyboard, contrast, and reduced-motion fallbacks.

## Recommended reading order

1. Read the integrated master specification.
2. Read the Ultimate product/experience companion and implementation deep dive.
3. Read the UI/UX system specification before implementing cursor-local controls or visual polish.
4. Read the architecture audit before reusing any text from the supplied draft.
5. Read the detailed engineering guide for data-model and transaction decisions.
6. Implement the first two backlog epics only after agreeing the semantic schema and coordinate/tolerance policy.
7. Run the kernel evaluation plan before selecting Open CASCADE, Manifold, or any other kernel for production use.

## Scope statement

This is an engineering design package, not an assertion about undocumented internal implementation details of AutoCAD or Revit. It uses public CAD/BIM principles and browser platform constraints to define a safer architecture for Arq.

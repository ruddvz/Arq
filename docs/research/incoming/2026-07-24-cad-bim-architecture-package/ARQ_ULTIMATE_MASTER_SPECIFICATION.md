# ARQ: Ultimate Product and Experience Specification

## A consolidated zero-friction UX direction

> **Authority:** This is the product and experience companion to [ARQ_MASTER_TECHNICAL_SPECIFICATION.md](ARQ_MASTER_TECHNICAL_SPECIFICATION.md), not a competing source of truth. Implementation details live in [ARQ_IMPLEMENTATION_DEEP_DIVE.md](ARQ_IMPLEMENTATION_DEEP_DIVE.md).

Arq should make architectural work feel immediate without pretending that complex geometry, collaboration, and code checks are simple. The product goal is a local-first, browser-native spatial design environment where direct manipulation remains fast, the model remains valid, collaborators retain context, and difficult states are explained rather than hidden.

## 1. Product commitments

1. **Direct manipulation first.** Tools respond immediately with provisional previews, dynamic dimensions, and clear snap feedback.
2. **No modal dead ends.** Errors appear as non-modal diagnostics with recovery actions. Invalid persistent model states are still rejected atomically.
3. **Inspect through, not blind cycling.** Users can explicitly reveal semantic layers behind an occluder through a capped layer stack.
4. **Spatial options in context.** Frozen revisions and design branches compare as labelled ghost overlays inside the active view.
5. **Local-first collaboration.** Replicas converge semantic operations while Arq validates hosts, relations, constraints, and geometry products.
6. **Precision is visible in the contract.** Canonical coordinates are float64, render data is localised float32, and all tolerance limits are named and tested.
7. **Works progressively.** Browser, WebGPU, workers, and desktop shell capabilities enhance the product without becoming hidden prerequisites for the semantic model.

## 2. Zero-friction experience

~~~mermaid
flowchart TB
  Input["Direct manipulation or typed command"]
  Preview["Local provisional preview"]
  Validate["Revisioned model validation"]
  Product["Derived geometry and render products"]
  Diagnose["Non-modal diagnostic and recovery"]

  Input --> Preview
  Preview --> Validate
  Validate --> Product
  Validate --> Diagnose
  Diagnose --> Preview
~~~

### Contextual controls

The command palette, Inspector, HUD, radial menu, and keyboard shortcuts are different views of the same typed command system. A user can:

- select a wall and set a parsed quantity;
- type a command that creates the same wall;
- alter the same value through an Inspector;
- use a touch-accessible contextual control.

All paths produce the same revisioned semantic command.

### Selection

Normal click selects the front semantic target. An explicit inspect-through action opens an ordered candidate stack with semantic names such as curtain panel, mullion, wall finish, wall core, or column. The renderer does not expose raw mesh triangle IDs as the user-facing hierarchy.

### Invalid proposals

An invalid opening, wall join, constraint, or rule check is shown with:

- a provisional ghost or warning boundary;
- concise explanation of the failed condition;
- affected semantic elements;
- retry, adjust, or cancel actions;
- a persistent diagnostic trail when applicable.

It does not show a blocking modal by default, nor does it corrupt the committed BIM model.

## 3. Runtime and platform strategy

The browser engine is primary. The model worker serialises canonical state. Geometry, imports, rules, and optional renderer work are bounded asynchronous jobs. Tauri is an optional desktop shell around the same frontend, not a different canonical geometry engine or automatic direct-Metal renderer.

| Stage | Outcome | Gate |
| --- | --- | --- |
| Web foundation | Precision-safe 2D/2.5D authoring, plan snapping, revisioned local persistence | Semantics, coordinate policy, undo, fixtures |
| Responsive geometry | Deferred CSG, robust wall/opening products, multi-view packets | Stale-result, memory, and failure-path tests |
| Collaboration | Semantic operation sync, comments, option overlays | Deterministic convergence and conflict diagnostics |
| Desktop shell | File integration, native menus, optional window effects | Capability/security review and packaged-build QA |
| Native rendering evaluation | Only if browser/WebView profiling misses an approved requirement | Measured cost and portability decision |

## 4. Spatial branches and ghost overlays

A design branch has a named base checkpoint, semantic operation history, and materialised revision. Ghost mode renders a frozen comparison packet with:

- visible branch/revision label;
- adjustable opacity and non-colour pattern;
- selection policy that defaults to the active branch;
- a clear action to inspect or promote the comparison branch;
- merge through semantic transactions and validation.

Branches may be economical, but they are not free. Arq budgets their snapshots, derived products, synchronization, and merge validation.

## 5. Quality bar

Arq avoids universal claims such as fixed 120 FPS, zero merge conflicts, or instant file opens. Its quality bar is measured by target device and corpus:

- pointer-to-preview latency;
- snap and selection latency;
- frame-time percentiles by view;
- committed transaction and derived-geometry latency;
- memory, job cancellation, and stale-result rates;
- accessible command and input completion;
- deterministic document replay and collaboration convergence.

The supporting engineering contracts and acceptance gates are in [ARQ_IMPLEMENTATION_DEEP_DIVE.md](ARQ_IMPLEMENTATION_DEEP_DIVE.md), [ARQ_UI_UX_SYSTEM_SPECIFICATION.md](ARQ_UI_UX_SYSTEM_SPECIFICATION.md), and [IMPLEMENTATION_BACKLOG.md](IMPLEMENTATION_BACKLOG.md).

## 6. Contextual interaction and visual-system policy

Arq should make direct manipulation feel close to the object without making direct manipulation unsafe.

1. A cursor-local HUD is passive around the canvas and interactive only where it presents actual controls.
2. A typed or scrubbed value remains a local draft or preview until the proposal passes normal transaction validation.
3. A command palette, keyboard shortcut, inspector field, radial action, and diagnostic quick fix all produce the same semantic proposal type.
4. A dismissed diagnostic chip hides only that presentation. Persistent model issues remain in the diagnostics surface.
5. Glass blur, squircle corners, and spring motion are progressive visual enhancements with opaque, keyboard, contrast, and reduced-motion fallbacks.
6. Velocity tilt is cosmetic, based on measured pointer velocity, capped, and disabled while an input has focus.

The full component and verification contract is [ARQ_UI_UX_SYSTEM_SPECIFICATION.md](ARQ_UI_UX_SYSTEM_SPECIFICATION.md).

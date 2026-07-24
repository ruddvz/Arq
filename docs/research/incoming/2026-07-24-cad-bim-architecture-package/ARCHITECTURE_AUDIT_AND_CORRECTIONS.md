# Architecture Audit and Corrections for the Supplied Arq Draft

## Verdict

The supplied draft identifies the most important high-level principle correctly: a browser renderer must not be the canonical CAD/BIM model. It also correctly calls out float32 render precision, worker offloading, spatial acceleration, and the need for parametric relationships.

It is not ready to implement unchanged. Several claims are too absolute, several code samples would produce incorrect behaviour, and key system boundaries are missing. Implementing the draft literally would create a fast-looking prototype that becomes brittle under undo/redo, constraints, imports, collaboration, and large models.

This audit identifies what to keep, what to correct, and the required replacements.

## 1. What should be retained

| Supplied idea | Keep? | Corrected form |
| --- | --- | --- |
| Three.js mesh is not source of truth | Yes | Make a semantic double-precision document the source of truth; mesh and scene objects are derived caches |
| Use B-Rep for advanced geometry | Yes | Isolate it behind a kernel adapter and treat it as a derived geometric product, not the whole BIM model |
| GPU needs local coordinates | Yes | Define a coordinate-frame policy and localise in float64 before float32 conversion |
| Use spatial acceleration for snapping | Yes | Use revisioned R-tree/BVH indexes and screen-space tolerance conversion |
| Offload expensive work | Yes | Use an authoritative model worker, bounded kernel jobs, cancellation, and stale-result rejection |
| Parameter relationships need recompute | Yes | Separate directed derivation from constraint solving and semantic relations |
| Use transactions and undo | Yes | Use typed commands, isolated staging, atomic commit, and semantic inverse policy |

## 2. Critical corrections

### 2.1 B-Rep is not exact arithmetic or unlimited zoom

The phrase "infinite precision zooming" is misleading. A B-Rep can preserve the mathematical definition of a line, cylinder, NURBS curve, or trimmed face better than a display mesh, but:

- coordinates are normally floating point
- intersections and trims are tolerance-sensitive
- NURBS evaluation and surface/surface intersections are numerical
- topology repair and healing are common
- display tessellation still has a finite error budget

**Required correction:** describe B-Rep as a topology plus geometry representation with tolerance-aware computation. Build a document-level tolerance policy, validation reports, and controlled failure states.

### 2.2 B-Rep alone does not make Arq a BIM engine

The draft focuses heavily on topology:

~~~text
Body -> Shell -> Face -> Loop -> Coedge -> Edge -> Vertex
~~~

That is valuable geometry information, but it cannot answer:

- Is this wall an external wall, an internal partition, or a generic solid?
- Which level controls its height?
- Which type defines its layer stack?
- Which window is hosted by it?
- Which IFC GlobalId and property sets belong to it?
- Is the value an instance override or a type parameter?

**Required correction:** make semantic BIM records, types, property sets, relations, placement, and provenance first-class persistent data. Geometry must be derived from those records.

### 2.3 Avoid undocumented claims about commercial products

The draft attributes detailed internal data and evaluation behaviour to AutoCAD and Revit. Public product behaviour can inspire Arq, but undocumented implementation claims are not a safe architecture dependency.

**Required correction:** phrase the guide as CAD/BIM design principles and define Arq's own contract. Avoid saying Arq reproduces a particular proprietary engine's internals.

### 2.4 A DAG is not a universal parametric solver

The draft models all relationships in one directed acyclic graph. That fails for legitimate geometric constraints:

- two points coincident
- line A parallel to line B
- a distance dimension between two movable walls
- equality groups and alignment chains

These can form cycles intentionally. A topological sort should schedule derivation, while a solver handles constraints.

**Required correction:** create four distinct structures:

1. semantic relationship graph
2. derivation DAG
3. constraint solve graph
4. kernel topology graph

### 2.5 Float64 is not a substitute for coordinate frames

Using float64 on CPU is necessary but not enough. A building needs explicit project, site, level, element, and render coordinate frames. Otherwise:

- imported geographic coordinates pollute all modelling operations
- local element operations become numerically awkward
- a scene cannot tell when to change local render origin
- export loses the transform needed to reconstruct the original site context

**Required correction:** store georeference and working project coordinates separately. Make placements and transforms part of document semantics.

### 2.6 The renderer-high/low shader is incomplete

The supplied shader subtracts camera high/low components and then multiplies by a model-view matrix. If that model-view matrix contains the ordinary camera translation, it can subtract translation twice.

It also does not specify:

- coordinate frame of attributes
- origin and model transform order
- precision qualifiers
- how matrices are constructed
- how normal vectors and pick rays stay consistent

**Required correction:** use normal local-origin render buffers first. Only add high/low RTE after a measured need, with a complete coordinate convention and shader test suite.

### 2.7 SharedArrayBuffer is not a generic zero-copy switch

The draft presents SharedArrayBuffer as an implementation detail of buffer transfer. The mechanisms differ:

- transferring an ArrayBuffer moves ownership and normally detaches the sender
- a SharedArrayBuffer stays available to multiple agents
- shared memory requires a secure, cross-origin-isolated page and synchronisation discipline

**Required correction:** make transferable ArrayBuffer the normal mesh-packet path. Use shared memory only as a guarded optimisation with a feature-detected fallback.

### 2.8 IFC and DWG are not peer milestones

IFC is a semantic built-asset standard. DWG is a proprietary drawing format with a separate licensing and compatibility ecosystem. STEP is geometry-centric.

**Required correction:** define three separate capability statements:

- IFC subset: semantic import/export with known entity and property coverage
- DXF subset: scoped 2D drafting interchange
- DWG: deferred licensed product decision

## 3. Bugs in the supplied code

### 3.1 DependencyGraph propagates incorrectly

The supplied graph computes a topological order for the entire graph, but calls evaluate only when a node is listed directly in dirtyNodeIds:

~~~typescript
executionOrder.forEach((id) => {
  if (dirtyNodeIds.includes(id)) {
    this.nodes.get(id)?.evaluate();
  }
});
~~~

Changing a level would evaluate the level but not the dependent wall or hosted opening. This defeats the stated dependency system.

Other defects:

- a missing dependency is silently ignored
- no duplicate-node protection
- node dependency Sets are mutable from outside
- the full graph is sorted for every edit, even when a tiny subgraph changed
- the error identifies no cycle path
- the execution order relies on insertion order rather than a documented stable order

**Fix:** compute reverse edges, find every downstream dependant, topologically sort the impacted subgraph, and evaluate all impacted nodes. The reference implementation does this.

### 3.2 CADSnapEngine is not an R-tree snapping engine

The class has a Map of segments but never inserts, queries, updates, or uses an R-tree. It calculates a snap against one supplied segment only.

Other defects:

- distancePx contains world units
- pixelThresholdWorld is not derived from camera scale
- no broad-phase query
- no segment intersection
- no perpendicular snap despite the enum
- no global ranking across candidates
- endpoint checks return early, so candidate result depends on query order
- nearest projection says onSegment only for the un-clamped parameter, but degenerate and extension behaviour is not defined
- 3D segment intersection is ambiguous without a work plane or depth policy
- no tolerance policy or duplicate candidate handling

**Fix:** use a revisioned plan primitive index, query a screen-derived world tolerance box, generate all candidates, rank deterministically, and label output distance in actual pixels. The supplied reference snap implementation establishes this contract.

### 3.3 The data type claims are overstated

In TypeScript, number is IEEE 754 double precision already. Commenting every number as "float64" can communicate intent but does not enforce units, coordinate frame, finite values, or tolerance consistency.

**Fix:** use named types or records for units and coordinate frames, validate finite values at API boundaries, and ban untyped screen-space values in semantic commands.

### 3.4 The graph ignores constraint semantics

The graph's evaluate callback has no transaction context, input signature, result value, errors, or rollback. It cannot safely model formulas or geometry regeneration.

**Fix:** evaluators return structured results and write only into staging state. Dependencies refer to immutable revisioned inputs.

### 3.5 The Boolean description guarantees too much

The draft says a door opening is formed by exact analytical intersection and topology mutation. Real robust modelling needs tolerance, validation, and failure paths. Inputs may be coincident, malformed, non-manifold, or beyond algorithm limits.

**Fix:** formalise Boolean status, diagnostics, validation, healing policy, and atomic rejection.

## 4. Missing architecture that must be added

### 4.1 Command protocol and revision control

The draft says "transaction" but does not define:

- command schema
- base revision
- transaction ID
- stale result rejection
- atomic staging
- undo semantics
- remote conflict behaviour
- job cancellation

Without these, worker concurrency will corrupt state eventually.

### 4.2 Document schema and migrations

There is no versioned file schema, import provenance, unknown-field policy, or deterministic migration plan. A CAD/BIM product cannot rely on live in-memory structures as its file format.

### 4.3 Unit and coordinate policy

There is no canonical length unit, angle unit, display unit, rounding policy, local placement convention, handedness definition, or IFC coordinate mapping rule.

### 4.4 Element semantic layer

Missing entities include:

- document/project/site/building/storey hierarchy
- wall and family types
- materials and compound layers
- containment, host, aggregation, and type relations
- properties, classifications, phases, and provenance
- room boundaries and spatial zones

### 4.5 Error model and recoverability

Missing states include:

- rejected transaction
- invalid geometry
- pending geometry
- cancelled job
- stale job result
- import warning
- unsupported source feature
- partially mapped source entity
- memory or time budget exceeded

### 4.6 Persistence, crash recovery, and collaboration

The draft has no answer to:

- how a local file is saved safely
- how command logs and snapshots are reconstructed
- how two users edit a hosted element at once
- how a client reconnects after being offline
- how permission and server validation work

### 4.7 Browser compatibility

The draft assumes SharedArrayBuffer, multithreaded WebAssembly, and possibly OffscreenCanvas. Each needs capability detection and fallback. Cross-origin isolation also changes the way a site may load external resources.

### 4.8 Resource control

Geometry jobs need time, memory, queue, and tessellation-density limits. Imported files can be adversarial or simply enormous.

### 4.9 Test strategy and benchmark corpus

No system of this complexity is "perfect" based on an architecture diagram. It needs deterministic replays, fuzzing, geometry goldens, visual regression, performance corpus, and release gates.

## 5. Recommended replacements for risky phrases

| Risky phrase | Better engineering language |
| --- | --- |
| Exact Boolean operations | Tolerance-aware B-Rep Boolean operations with validation and diagnostics |
| Infinite precision zooming | Retains analytic intent; rendering still uses finite tessellation and GPU precision |
| Keep frame rates locked at 60 FPS | Maintain responsive input through budgets, async work, and adaptive quality; measure by target device |
| Zero-copy transfer | Transfer ownership of an ArrayBuffer, or share memory where cross-origin isolation is available |
| Revit does X internally | Arq will implement this documented behaviour using its own explicit contract |
| Implement IFC 4.3 and DXF/DWG | Deliver a published IFC subset, scoped DXF support, and a separately decided DWG strategy |
| R-tree snap engine | Broad-phase index plus narrow-phase analytic candidate generator and deterministic ranking |

## 6. What not to build first

Avoid these until the foundation is proven:

- arbitrary NURBS surface modelling
- arbitrary B-Rep Boolean editing through the UI
- a custom general constraint solver without a small controlled feature scope
- full DWG compatibility claim
- full IFC 4.3 coverage claim
- live CRDT merge of all geometric entities
- renderer-driven persistent model changes
- SharedArrayBuffer required for ordinary usage
- per-pointer-move Boolean commit

## 7. Priority order of fixes

### Must be defined before implementation

1. semantic document schema
2. coordinate frames, units, and tolerance policy
3. worker command/revision protocol
4. transaction/undo model
5. separation of DAG and constraint solver
6. render-cache and stale-result rules
7. capability matrix for IFC/DXF/DWG

### Build in the first vertical slice

1. plan walls and levels
2. revisioned command history
3. plan spatial index and snapping
4. generated 2.5D representation
5. local-origin renderer
6. deterministic save/restore
7. benchmark and diagnostic harness

### Defer until evidence requires it

1. full B-Rep kernel integration
2. advanced booleans
3. broad file-format coverage
4. multi-user semantic merges
5. WebGPU-only acceleration

## 8. Acceptance test that exposes the original code defects

Use this sequence:

1. Create Level 1 and Level 2.
2. Create a wall constrained from Level 1 to Level 2.
3. Host a window in the wall.
4. Change Level 2 height.
5. Confirm the wall and window update in the same committed revision.
6. Undo and confirm semantic values, wall product, section, snap index, and render cache all return to the prior revision.
7. Repeat while a prior tessellation job is still running.
8. Confirm the old job result is discarded and cannot overwrite the newer wall.

The supplied graph implementation fails step 5 because it does not propagate the dirty closure. A renderer-only model often fails step 6. An unversioned worker system often fails step 8.

## 9. Bottom line

Use the supplied document as a useful architectural starting point, not as code specification. The corrected package preserves its strongest insight while replacing the unsafe simplifications with:

- a semantic canonical model
- revisioned transactions
- explicit coordinate/tolerance policy
- separate derivation and constraint systems
- realistic B-Rep and browser worker boundaries
- scoped interchange
- measurable reliability gates

## 10. Addendum: corrections applied to the later master blueprint

The later master blueprint adds a strong product vision for local-first collaboration, contextual UI, WebGPU, and rule checking. The integrated master specification keeps that vision and changes the following implementation claims.

| Raw blueprint statement | Why it cannot be the final contract | Accepted replacement |
| --- | --- | --- |
| B-Rep TopoDS shape is the source of truth | B-Rep does not contain all BIM semantics, provenance, undo, type, or collaboration state | Semantic float64 document is source of truth; B-Rep is a derived geometry product |
| Zero precision compromise / zero accuracy loss | Float64, tolerance-aware booleans, GPU f32, tessellation, and numerical intersections all have limits | Named precision target, coordinate frames, tolerance policy, and measured fixtures |
| Camera-relative CPU buffer upload on every rendering step | Camera movement can force large vertex-buffer rebuilds | Stable local render chunks; camera moves through local uniforms; high/low path only when measured |
| All elements are DAG nodes | Constraints and semantic relationships are not all directed acyclic | Separate semantic relation graph, derivation DAG, constraint groups, and kernel topology |
| CRDTs produce conflict-free architectural editing | Convergence does not guarantee valid hosts, constraints, or topology | CRDT converges semantic operations; canonical resolver validates and surfaces conflicts |
| Loro map of raw wall fields is enough | Does not model host relations, source revisions, operation order, or validation | Immutable semantic operation envelopes, stable IDs, causal stamps, and rebuild boundary |
| Universal hard-coded OBC/IBC values | Legal requirements vary by jurisdiction, edition, scope, and interpretation | Approved jurisdictional rule packs with source, applicability, version, and review status |
| WebGPU/compute means 120 FPS | Performance depends on scene, device, browser, data transfer, and implementation | Benchmarked performance objectives by target device and corpus |
| Native IFC 4.3, STEP, DXF/DWG import/export | These formats have radically different scope and fidelity challenges | IFC subset matrix, geometry-first STEP/IGES, scoped DXF, separately licensed DWG decision |
| Fixed epsilon expansion solves Boolean ambiguity | A fixed value is invalid across units/models and may damage tiny features | Named document tolerance policy plus operation diagnostics and validation |

The later blueprint's product direction remains valuable. Its raw code examples should be replaced by the reference contracts in this package before implementation.

## 11. Addendum: implementation deep-dive and Ultimate specification corrections

The later deep-dive correctly identifies selection friction, expensive geometry during dragging, modal interruption, and design-option comparison as material product risks. It requires the following corrections before code is adopted.

| Raw implementation claim | Defect | Corrected package contract |
| --- | --- | --- |
| Peel every GPU layer for cursor hover | Full-screen or frequent multipass rendering/readback harms interaction and can return stale IDs | Default to one-layer semantic ID selection; invoke capped, cursor-scissored inspect-through on explicit user intent |
| A four-byte buffer with 256-byte bytesPerRow readback | Violates WebGPU copy layout requirements | Allocate a 256-byte aligned staging slot per layer and map the combined request once |
| Sample depth32float as a normal float texture while rendering it | Wrong shader resource model and attachment hazard | Bind prior depth as a depth texture and ping-pong fresh render targets between passes |
| One depth epsilon works everywhere | Depth precision depends on projection, near/far planes, scale, and tolerance policy | Carry a measured, named view-aware tolerance |
| Rust vector scan is a SIMD BVH raycast | It is O(N) point-in-box testing | Use a real packed BVH or R-tree after benchmarked evaluation |
| Run a heavy Boolean after a fixed timer | Timer does not make result acceptance safe | Commit semantic intent first, then run a cancellable revision/signature-stamped derived job |
| Non-modal means always accept the proposal | Silent invalid commits corrupt the document | Keep the preview and diagnostic non-modal; reject invalid canonical transactions |
| Tauri provides a Metal backend | Tauri hosts a WebView and does not by itself replace the graphics backend | Use Tauri as an optional shell with a capability adapter and browser fallback |
| A glass UI is complete when it animates | Raw components lack focus, dialog, input-draft, reduced-motion, and contrast behavior | Require accessible contextual controls and controlled quantity parsing |
| CRDT branches are zero cost | Branch snapshots and merge validation use time/memory and can produce semantic conflicts | Use revision-pinned ghost overlays and normal semantic merge validation |

The corrected implementation specification is [ARQ_IMPLEMENTATION_DEEP_DIVE.md](ARQ_IMPLEMENTATION_DEEP_DIVE.md). It includes source links to the current WebGPU, WGSL, Tauri, and window-vibrancy documentation and is the implementation companion to the master specification.

## 12. Addendum: Apple-grade UI playbook corrections

The supplied interaction and visual playbook identifies the right product problems: mouse travel, modal interruption, weak selection, lagging geometry, and detached design options. Its components need a stricter production boundary.

| Raw UI claim or sample | Defect | Corrected contract |
| --- | --- | --- |
| Cursor-following HUD position creates velocity tilt | Mapping absolute screen X to rotation does not measure motion | Derive capped decorative tilt from pointer velocity and stop it while typing or under reduced motion |
| Full HUD can receive pointer events | Floating surface can block orbit, pan, selection, and context gestures | Make decorative HUD body pointer-pass-through and activate only real inputs/buttons |
| Convert every input change with Number | Empty and partially typed numeric strings can become invalid values | Keep a controlled text draft and commit only finite, range-valid quantities |
| Scrub every changing number directly | Per-pointer mutation creates excessive transactions, undo entries, and collaboration noise | Preview during pointer capture; commit one typed semantic proposal on release |
| Command palette invokes action callbacks | Any action can bypass revision, permissions, undo, and domain validation | Commands produce typed proposals for the normal model gateway |
| Plain clickable palette rows are enough | Missing dialog focus, keyboard semantics, names, and composition behavior | Follow a selected accessible dialog/list interaction pattern |
| A chip quick fix can mutate immediately | Diagnostic can be stale after remote or local model change | Verify source revision and submit a normal transaction proposal |
| Glass is the primary surface | Blur can degrade a high-frequency canvas and reduce contrast | Use opaque baseline surfaces and capability-gated blur for small overlays |
| corner-smoothing guarantees a squircle | It is not a dependable standard web primitive | Use border-radius baseline and optional supported corner-shape enhancement |
| Tabular figures solve all numeric jitter | Stable glyph widths do not validate values or guarantee layout stability | Use tabular figures where supported plus stable layout, labels, and controlled drafts |

The corrected UI package is [ARQ_UI_UX_SYSTEM_SPECIFICATION.md](ARQ_UI_UX_SYSTEM_SPECIFICATION.md), with production reference contracts and ADRs 010 and 011.

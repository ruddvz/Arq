# ARQ: Web-Native Architectural CAD and BIM Engine

## Master Technical Specification and Architecture Blueprint

**Status:** governing technical specification  
**Version:** 2.0  
**Date:** 24 July 2026  
**Audience:** product, platform, geometry, rendering, interoperability, collaboration, and AI engineering teams

## Document authority

This document integrates the two supplied Arq blueprints with the engineering corrections in this package. It is the top-level product and architecture direction.

The following documents remain normative for their specialised areas:

- **ARQ_CAD_BIM_ENGINEERING_GUIDE.md** for data model, transactions, interoperability, testing, and detailed engineering decisions
- **ARCHITECTURE_AUDIT_AND_CORRECTIONS.md** for claims that must not be implemented literally
- **IMPLEMENTATION_BACKLOG.md** for work order and acceptance criteria
- **KERNEL_EVALUATION_PLAN.md** for selecting a geometry kernel
- **decision_records/** for accepted decisions
- **reference/** for tested TypeScript and WGSL contracts

Where a raw blueprint statement conflicts with this specification or an accepted ADR, this specification and the ADR prevail.

## 1. Product vision

Arq is a local-first, browser-native architectural design and BIM platform. It should make precise building modelling, responsive plan work, generated 3D, structured information, real-time collaboration, and review workflows feel coherent in one application.

Arq takes useful ideas from established tools without copying their limitations:

| Design influence | What Arq adopts | What Arq avoids |
| --- | --- | --- |
| CAD | precise input, snapping, direct commands, layers and drawing discipline | renderer-as-document and ribbon-first workflow |
| BIM | semantic elements, types, hosts, levels, schedules, properties, and exchange | monolithic file coupling and hidden derived state |
| conceptual modelling | fast massing, site context, visual exploration | treating an approximate mesh as a valid building record |
| collaborative canvases | presence, comments, shared review, local-first availability | raw object merge that breaks architectural constraints |
| modern web applications | immediate interaction, background work, resilient offline behaviour | making browser capabilities a reason to weaken model correctness |

### 1.1 What success means

An architect should be able to:

1. open a local project immediately and work offline
2. draw or edit a wall accurately in plan with predictable snapping
3. see the corresponding 3D and section result from the same canonical model
4. change a level, type, or host relation and see only the affected model regenerate
5. collaborate without losing edits or silently damaging walls, openings, or constraints
6. understand whether a rule result is a warning, a verified check, or a professional-review requirement
7. export only the interoperability claims Arq can substantiate

### 1.2 Non-negotiable engineering principles

1. **Semantic model first.** The persistent source of truth is a versioned semantic building document in float64, not a Three.js scene, a mesh, or a raw B-Rep handle.
2. **Geometry is derived.** Profiles, B-Rep products, topology handles, tessellations, spatial indexes, and GPU buffers are regenerated from semantic intent and revisioned inputs.
3. **No invisible partial state.** Model changes occur through typed transactions and atomic document revisions.
4. **Precision is managed, not promised.** CPU-side float64, coordinate frames, tolerance policy, and local render origins prevent avoidable error. No finite system provides literal zero-error or unlimited precision.
5. **Collaboration converges intent, then validates it.** A CRDT solves distributed convergence, not BIM validity.
6. **The UI never waits on a Boolean to stay usable.** Long computation is cancellable background work with an honest pending state.
7. **Every format and rule claim is scoped.** No blanket promise of full DWG fidelity, complete IFC 4.3 round trip, or universal code compliance.

## 2. Product experience and interaction system

### 2.1 Workspace shell

Arq uses a calm persistent shell, not a 500-icon ribbon:

- project and branch identity
- active view and level selector
- collaboration state, share, comments, and conflict status
- command palette entry point
- compact snap, grid, orthographic, unit, and selection status

The canvas remains central. Detailed inspectors are available, but ordinary wall, opening, level, type, and view actions must not require modal navigation.

### 2.2 Contextual HUD

When a user selects or creates an element, the HUD exposes only command-relevant controls:

| Context | First controls | Secondary route |
| --- | --- | --- |
| Wall selected | length, thickness/type, base/top constraint, join/flip | full inspector |
| Opening selected | host, width, height, sill/head constraints | family/type editor |
| Level selected | elevation, name, associated views | project explorer |
| Room selected | boundary status, area, occupancy/property set | schedule |
| Active drawing command | numeric input, angle, constraint lock, snap state | command options |

Rules:

- do not cover the active snap point or primary selection handle
- use keyboard focus and screen-reader labels
- keep actions stable enough for muscle memory
- expose an overflow route rather than permanently showing every property
- never let a HUD edit bypass the command transaction pipeline

### 2.3 Command palette and typed input

The command palette is an interaction router, not a text-to-model bypass.

It can:

- discover commands, recent tools, elements, views, and properties
- parse constrained commands into a proposed typed command
- show units and ambiguity before execution
- require confirmation when a command affects many elements
- surface audit and rule-report commands

It cannot:

- run arbitrary JavaScript from a project
- mutate the document before schema and semantic validation
- invent a jurisdictional code value
- turn vague natural language into irreversible edits without a preview or confirmation

### 2.4 Multi-view coordination

Plan, section, elevation, 3D, schedule, and property views consume the same committed document revision.

Selection behaviour:

- selecting a semantic element highlights it in every compatible view
- selecting a schedule row selects the same semantic element
- a view may show an element differently due to cut plane, phase/filter, or level of detail, but it must report the same identity
- a stale view packet is discarded rather than rendered as current

### 2.5 Presence, comments, and collaboration UX

Presence is useful when it remains lightweight:

- collaborator cursors in plan/sheet views
- view frustum or focus indicator in 3D
- selection outline labelled with collaborator identity
- anchored comments that store a semantic target plus an optional revisioned geometric anchor
- branch/option awareness and explicit conflict badges

Presence, cursor position, and camera are transient awareness state. They are not part of the canonical building document and do not create undo entries.

### 2.6 Right-click and radial actions

Use a radial menu only for a small, context-safe action set:

- trim/extend, split, align, offset, flip, host/unhost, isolate, and inspect where valid
- keyboard alternatives for every action
- no destructive action without clear target highlight
- hide in touch/keyboard contexts where it reduces accessibility

The menu should not promise a sub-100 ms operation if the requested operation requires a kernel transaction. It may show a preview immediately and commit asynchronously.

## 3. Governing architecture

~~~mermaid
flowchart TB
  UI["UI, input and transient view state"]
  Render["WebGL2/WebGPU renderer and view caches"]
  Model["Authoritative semantic model worker"]
  Jobs["Bounded geometry, import and analysis workers"]
  Data["Local persistence, sync and server validation"]

  UI -->|"typed commands"| Model
  Model -->|"revisioned render packets"| Render
  UI -->|"view and selection requests"| Render
  Model -->|"cancellable jobs"| Jobs
  Jobs -->|"validated derived results"| Model
  Model -->|"snapshots and operation log"| Data
  Data -->|"converged semantic operations"| Model
~~~

### 3.1 Runtime ownership

| Runtime area | Owns | Must not own |
| --- | --- | --- |
| Main thread | input, accessibility, provisional preview, UI panels, render scheduling | canonical model mutation, B-Rep native state |
| Renderer | GPU resources, draw IDs, local buffers, visual pick acceleration | persistent semantic IDs as draw IDs, undo state |
| Model worker | document revisions, transactions, semantic graph, indexes, validation | DOM, React state, GPU handles |
| Geometry/import workers | kernel handles, parsing, tessellation, sectioning, rule computation | document revision assignment |
| Persistence/sync | durable snapshots, operation delivery, permissions, published revision ordering | silent geometry repair |

### 3.2 Data strata

| Stratum | Canonical? | Examples |
| --- | --- | --- |
| Semantic BIM document | Yes | wall type, level, host relation, properties, units, georeference |
| Geometric intent | Yes | path, profiles, placements, parameters, feature inputs |
| Derived geometry | No | B-Rep handle, section curves, tessellation, topology map |
| Acceleration | No | R-tree, BVH, text layout, room-boundary cache |
| Presentation | No | render object, buffer, draw ID, HUD anchor, hover state |

### 3.3 The correct dual-engine model

Arq has two derived engines, not two competing sources of truth:

~~~mermaid
flowchart TB
  Doc["Semantic document and geometric intent"]
  Derive["Derivation and constraint services"]
  Kernel["Optional B-Rep/procedural geometry kernel"]
  Tess["Tessellation and 2D view products"]
  GPU["Renderer buffers and drawables"]

  Doc --> Derive
  Derive --> Kernel
  Derive --> Tess
  Kernel --> Tess
  Tess --> GPU
~~~

The semantic document explains what an element is. The geometry kernel explains how its advanced shape is produced. The renderer explains how it is drawn now.

## 4. Canonical data, dependencies, and transactions

### 4.1 Persistent document

The document must include:

- schema version, document ID, branch/revision ID, and migration history
- unit, angle, tolerance, coordinate, and georeference policy
- project, site, building, storey, level, grid, element, type, material, property, and relation records
- semantic parameter values, formulas, placements, host relations, and source provenance
- operation log/checkpoint references and deliberate undo grouping metadata

Use metres and radians internally. Display units are presentation policy. Geographic coordinates are preserved through a separate georeference transform, not copied into every vertex.

### 4.2 Graph separation

The phrase "all elements are a DAG" is too broad. Arq uses distinct systems:

| System | Examples | Cycle policy |
| --- | --- | --- |
| Semantic relationship graph | containment, host, type, join, references | valid cycles may exist |
| Derivation DAG | level -> wall height -> opening cut -> section cache | cycles are errors |
| Constraint groups | alignment, equal distance, coincident points | solve and diagnose, not topologically sort |
| B-Rep topology | vertex/edge/coedge/loop/face adjacency | kernel-owned topology |

The dependency graph only schedules directed recompute. It must compute the full dirty descendant closure and evaluate only the impacted subgraph in deterministic order.

### 4.3 Transaction lifecycle

1. UI creates a typed command proposal from direct manipulation, HUD, palette, import, script, or remote operation.
2. Model worker checks document revision, schema, permissions, references, units, and finite values.
3. Worker stages an isolated transaction.
4. Formula and constraint services run against staging state.
5. Derivation DAG computes invalidated products and schedules cancellable jobs.
6. Worker atomically publishes the next document revision or rejects the whole transaction.
7. Render/index/rule invalidations carry the committed revision and input signatures.

Undo creates a new valid revision by applying a semantic inverse policy. It never reuses an old renderer buffer or rewinds global revision numbers.

### 4.4 Stable identities

Every durable entity needs a stable document-owned ID:

- element, type, relationship, property set, command, transaction, imported source, and comment
- a kernel handle, mesh index, array offset, GPU draw ID, or R-tree leaf is never a durable ID

## 5. Geometry, topology, and wall behaviour

### 5.1 B-Rep capability

Open CASCADE or another kernel may provide B-Rep construction, Boolean operations, sectioning, validation, and STEP/IGES geometry exchange. It must sit behind the GeometryKernel adapter defined elsewhere in this package.

Do not treat a kernel-owned shape as the whole building record. It cannot independently preserve all BIM semantics, type history, property sets, command provenance, or collaboration conflicts.

### 5.2 Architectural product order

Start with deterministic procedural architecture:

1. wall path, type, layer stack, base/top constraints, openings, and host placement
2. slabs, columns, simple roofs, rooms, dimensions, annotations, and sections
3. clean plan and generated 2.5D/3D products
4. advanced B-Rep operations only where semantic/procedural builders cannot provide the required result

This delivers useful BIM behaviour sooner and keeps kernel adoption reversible.

### 5.3 Wall joins

Wall joins are a semantic feature with a generated geometric result. They must not be an accidental intersection of render meshes.

For each join:

- identify participating wall axes, types, layers, and local topology
- handle a deliberately supported set of junctions first: T, L, X, nearly parallel, unequal thickness, and endpoint join
- apply layer priority and location-line rules in 2D profile space
- use an explicit miter limit and deterministic fallback, such as butt, bevel, or square
- detect self-intersection, tiny slivers, zero thickness, and invalid loop orientation before extrusion
- keep an unresolved join state with diagnostics when a supported clean solution cannot be produced

Do not use a universal fixed angle or epsilon to solve every project. Limits derive from the document tolerance policy, wall type, and join policy.

### 5.4 Host openings and Boolean failure

Doors and windows are semantic occurrences hosted by a wall. The host stores a relation to the opening and local placement. The opening cut is a derived product.

For a cut:

1. validate host and local placement
2. generate the requested cut profile in host-local coordinates
3. expand or regularise only through a named tolerance policy and documented purpose
4. run kernel/procedural operation with revision and content signature
5. validate result topology
6. accept the derived result or retain the previous valid product and report a diagnostic

Never silently drop a failed opening, mutate a wall mesh in place, or hard-code a universal epsilon such as 0.001 mm.

## 6. Precision, coordinate frames, and GPU rendering

### 6.1 Precision contract

Arq uses:

- float64 CPU and WebAssembly data for canonical positions, transforms, geometry intent, snapping math, and distance calculations
- named coordinate frames for georeference, project, building, level, element, profile, and render chunk
- float32 GPU positions only after a float64 localisation step
- a versioned document tolerance policy rather than scattered magic values

The product target may require sub-millimetre modelling precision at building scale. The implementation must prove that target with fixtures, specific coordinate ranges, and target devices. It must not describe all floating-point error as zero.

### 6.2 Camera-relative versus render-origin data

The raw blueprint proposes subtracting the camera from every vertex before each GPU upload. That is correct numerically but poor as a default renderer architecture: every camera movement would force large buffer rewrites.

Arq uses this order:

1. Choose a stable local **render chunk origin** near the active building, level, or tile.
2. Subtract that origin in float64 while building a Float32Array vertex packet.
3. Keep vertex buffers stable while the camera moves inside the chunk.
4. Build the view-projection transform in chunk-local camera coordinates.
5. Rebuild packets only when geometry or chunk origin changes.
6. Use high/low coordinate splitting only for an evaluated mega-site mode that cannot fit safely in a chunk.

The **webgpu-render-origin.ts** and **high-low-render-origin.wgsl** references implement this boundary.

### 6.3 Correct high/low shader convention

WGSL GPU arithmetic is based on f32 and f16 scalar types, not normal f64 vertex arithmetic. High/low splitting is therefore an emulation technique for subtraction, not a promise of native double precision.

For the high/low path:

- position high/low and origin high/low must be in the same world frame
- shader subtracts the origin exactly once
- the view-projection matrix must operate in the resulting local frame
- it must not also contain a second world-origin translation
- pick rays, section planes, normal transforms, and culling planes use the same frame convention

### 6.4 Depth and visual quality

Origin shifting does not solve every depth issue. Arq also needs:

- sensible near/far plane management by view type
- consistent depth policy for opaque geometry, lines, overlays, and selection
- screen-space constant-width line rendering
- controlled level of detail and tessellation error
- explicit limits for enormous site overview views

## 7. Renderer architecture and performance

### 7.1 Rendering policy

WebGL2 is the compatibility baseline. WebGPU is the preferred enhancement path where supported and benchmarked. The renderer adapter must allow both without changing document or geometry semantics.

Three.js may be used as a rendering abstraction, but must be treated as a view-layer dependency. Its WebGPU renderer has a WebGL2 fallback mode in current official documentation, which supports a progressive adoption path. Arq must still independently test each required rendering feature on both backends.

### 7.2 Render packet contract

Every render packet contains:

- semantic element IDs
- derived geometry revision and input content signature
- chunk origin and local float32 positions
- normals, indices, material/style references, edge/classification metadata
- view-specific tessellation key
- explicit ownership/transfer policy

The renderer drops a packet if its revision, signature, or origin key is not current.

### 7.3 GPU resource lifecycle

Avoid buffer thrash during sliders and drags:

- use a lightweight declarative preview or dynamic parameter uniform while dragging
- coalesce UI events and submit one semantic command at an intentional checkpoint
- reuse bounded GPU allocation pools where profiling supports it
- update small dynamic ranges only when data remains in the same allocation
- fence or defer disposal according to GPU completion semantics
- never allocate B-Rep products or full re-tessellations per pointer event

The model worker should not wait for GPU fences. It publishes a semantic revision; renderer caches converge to it asynchronously.

### 7.4 Performance language

Arq targets fluid interaction, not a universal unmeasured claim of 120 FPS or instant opening on every model and device.

Release dashboards must report:

- target browser/device tier
- scene corpus and element count
- cold/warm open time
- pointer/snap latency
- frame-time percentiles by view mode
- geometry/job latency and memory
- cache hit rate and dropped stale packets

Adaptive quality may reduce shadows, tessellation, label density, or distant detail. It may never lower canonical model precision.

## 8. Selection, spatial indexing, and snapping

### 8.1 Index by purpose

| Need | Index/query path | Canonical target |
| --- | --- | --- |
| Plan snap | 2D primitive R-tree plus analytic narrow phase | curve/profile/semantic reference |
| 3D visible pick | GPU ID acceleration plus CPU fallback | semantic element |
| Precise model hit | ray/work-plane plus analytic or kernel test | geometry intent/product |
| Mesh culling | view-specific BVH or batches | transient render packet |
| Room/adjacency lookup | semantic boundary/index service | room/spatial relation |

An R-tree is useful for plan primitives. A BVH is useful for render meshes. They are not interchangeable descriptions of every query.

### 8.2 Stable snap workflow

1. Resolve cursor into the active work plane or an explicit 3D construction context.
2. Convert pixel snap tolerance into model space for the current view.
3. Query the revision-matched broad-phase index.
4. Generate all relevant candidate points, curves, and intersections.
5. Apply command-compatible precedence and deterministic tie-breaks.
6. Render transient HUD feedback with the candidate identity and dynamic dimensions.

Default precedence is a user-configurable policy. It cannot simply pick the first primitive returned by an index.

### 8.3 Modes

Build and test in this order:

1. endpoint, midpoint, intersection, nearest, grid, orthographic/polar tracking
2. perpendicular, tangent, extension, centre, arc/spline points
3. 3D face/edge/vertex, normal, work-plane, and projected reference modes

Do not advertise sub-millimetre snapping based on a fixed millimetre radius. The UI tolerance is screen-space; geometry rules are document-space.

## 9. Local-first collaboration

### 9.1 Collaboration model

Arq is local-first:

- open/save work is available from local durable storage
- local commands create immediate provisional or committed local state
- a CRDT or equivalent replication layer converges operation envelopes across peers
- a sync service provides identity, permissions, relay, durable checkpoints, published revision ordering, and auditability
- remote operations are semantically rebuilt and validated before becoming a shared canonical revision

Loro is a strong candidate because it is designed for local-first CRDT applications. It is not an architectural waiver for domain validation.

### 9.2 Semantic operation envelope

Collaboration replicates immutable semantic operations such as:

- create or delete element
- move element by a defined transform/delta
- set parameter
- attach or detach host
- add/remove constraint
- resolve a named conflict

Each operation carries:

- immutable operation ID
- author identity and causal stamp
- target semantic IDs
- base/intent context
- permission and schema information
- enough data to validate deterministically

The **semantic-operations.ts** reference demonstrates a CRDT-agnostic ordered operation log and resolver boundary.

### 9.3 Conflict policy

Examples:

| Concurrent situation | Expected behaviour |
| --- | --- |
| Two users move same wall | Converge operations deterministically; surface compound/conflicting motion if policy cannot safely combine it |
| One user deletes wall while another adds opening | Preserve both operations in log; resolver reports rejected/orphan opening and offers recovery |
| Two users change a type property | Use declared field conflict rule, attribution, and revision history |
| Concurrent host reassignment | Validate final host compatibility; require explicit conflict resolution when ambiguous |
| Comment/presence update | Merge freely because it does not alter canonical geometry |

Never claim "zero merge conflicts" for BIM. Promise visible, recoverable semantic conflicts instead.

### 9.4 Branches and options

Option exploration should use explicit branches or named design options:

- branch from an immutable checkpoint
- retain source operation set and metadata
- merge only through semantic comparison/validation
- show changed elements, unresolved conflicts, and migration impact

It is not safe to market architectural branch merge as universally zero-cost or instantaneous.

## 10. Building rules and spatial intelligence

### 10.1 Rule engine contract

Rules are asynchronous derived analysis. They never block ordinary editing and never silently change geometry.

Every rule result has:

- document revision and geometry/input signature
- rule pack ID, version, jurisdiction, edition, applicability, and authoritative source
- severity: information, warning, error, or requires professional review
- targets, evidence, and source reference
- stale-result invalidation

The **rule-engine.ts** reference defines this contract.

### 10.2 Jurisdiction and scope

Do not hard-code global values such as a universal egress width, bedroom area, daylighting ratio, FSI, or zoning maximum. Requirements vary with jurisdiction, code edition, building classification, occupancy, renovation scope, local amendment, and interpretation.

Arq can support:

- project-specific area, coverage, and FSI calculations based on configured site boundaries
- rule packs created from approved authoritative sources
- computer-interpretable information requirements such as buildingSMART IDS where relevant
- traceable review checklists and export reports

Arq must label results as review-required whenever an approved, applicable pack is missing or an interpretation is not computationally resolvable.

### 10.3 Spatial analyses

Potential analyses include:

- gross/net area and coverage
- path-network/egress calculations
- accessibility clearance geometry
- daylight/glazing or envelope metrics
- parking/site/zoning quantities
- model information quality requirements

Each analysis needs its own source model, tolerances, assumptions, validity domain, and test corpus. A Dijkstra pathfinding result is only as correct as the navigation graph and permitted-path policy that produced it.

## 11. Technology selection and version policy

### 11.1 Selection principles

Do not bake volatile package versions into an architecture promise. Pin exact versions in a compatibility manifest, lock file, release notes, and benchmark record.

| Layer | Direction | Guardrail |
| --- | --- | --- |
| UI | React is the default application-shell choice; Solid is an alternative, not a parallel default | choose one for the product shell |
| Language | strict TypeScript | runtime validation remains mandatory |
| Rendering | WebGL2 baseline, WebGPU enhancement, renderer adapter | no semantic dependence on renderer |
| Geometry | procedural builders first, B-Rep adapter after evaluation | kernel licence and corpus gate |
| Indexing | 2D R-tree plus targeted BVH/analytic indexes | revision-matched query results |
| Collaboration | local durable storage plus Loro/other CRDT candidate | semantic resolver and server validation |
| Rule analysis | worker-based versioned rule packs | source, edition, scope, disclaimer |
| Persistence | IndexedDB/local durable store plus server checkpoints | migrations and corruption recovery |

### 11.2 Wasm and worker policy

- compile/provision kernels through reproducible builds
- hold native objects only in their owning worker
- dispose resources deterministically and measure retained memory
- budget jobs by time, memory, queue depth, and cancellation responsiveness
- use transferable ArrayBuffer as the normal render-packet path
- make SharedArrayBuffer and WASM threads an optional enhancement guarded by cross-origin isolation and deployment tests

### 11.3 Interoperability policy

- IFC is semantic exchange with an explicit capability matrix, property mapping, and validation report
- STEP/IGES are geometry-first exchange, not reconstructed BIM semantics
- DXF is a scoped 2D exchange capability
- DWG is a separately licensed product decision, not a generic parser task

## 12. Security, privacy, and resilience

- parse all external files in workers with size, recursion, memory, and time limits
- never execute arbitrary project formulas, scripts, or imported code
- validate all worker/sync messages against versioned schemas
- enforce document permissions at the service boundary
- retain operation/audit metadata without collecting full project geometry in telemetry by default
- preserve source provenance and unsupported source entities honestly
- test crash recovery, migration failure, offline reconnect, and worker restart

## 13. Critical edge cases and required responses

| Failure mode | Incorrect shortcut | Required Arq response |
| --- | --- | --- |
| Large-coordinate jitter | Upload world-scale float32 vertices or re-upload all vertices per camera move | float64 frame localisation, stable render chunks, optional high/low path |
| Acute/unequal wall joins | Infinite miter, render-mesh overlap, or fixed global epsilon | semantic join policy, 2D profile validation, miter limit, deterministic fallback, diagnostic |
| Coincident Boolean faces | Assume kernel always returns valid geometry | named tolerance policy, validation, atomic reject/retain prior product |
| WASM heap growth | Allocate B-Rep objects on every pointer move | preview without heavy kernel, bounded worker jobs, explicit disposal and memory telemetry |
| GPU allocation thrash | create buffers per slider event | coalesced preview, pooled allocations where measured, revisioned render packets |
| CRDT collision | Merge raw geometry maps and declare success | converge semantic operations, rebuild/validate, conflict/recovery UI |
| DAG cycle | Treat all relations as directed dependencies | separate derivation DAG, constraints, semantic graph, and topology |
| Stale worker result | Let old tessellation replace a newer edit | revision + content signature check before acceptance |
| Massive or malformed import | Parse on UI thread and partially mutate document | worker sandbox, quotas, diagnostics, isolated import transaction |
| Rule result under wrong code edition | hard-code a generic threshold | versioned jurisdictional pack with source/applicability or review-required finding |
| Thin/hidden GPU pick | trust one draw-ID readback | CPU semantic fallback and view-aware query |
| Unsupported file entity | silently approximate and export as valid | preserve/report unsupported source content and publish capability matrix |

## 14. Delivery roadmap and phase gates

### Phase A: Foundation and proveability

Build:

- semantic document schema, IDs, migrations, and command history
- coordinate frames, unit/display policy, tolerance policy
- authoritative model worker and revisioned protocol
- reproducible benchmark corpus and diagnostic taxonomy
- renderer adapter proof of local-origin precision

Gate:

- deterministic replay creates the same canonical state
- stale jobs cannot overwrite newer revisions
- local render precision passes large-coordinate fixture
- UI remains responsive during synthetic long jobs

### Phase B: Excellent architectural plan editing

Build:

- walls, types, levels, grids, openings, dimensions, annotations
- plan primitive index and stable snapping
- direct manipulation preview, command palette path, HUD, keyboard input
- durable save/restore and undo/redo

Gate:

- level change updates all wall/opening dependants
- delete/move/host cases have explicit policy and tests
- snapping remains stable under pan/zoom/dense plan conditions
- no model mutation comes from renderer state

### Phase C: Deterministic 2.5D, sections, and multi-view

Build:

- procedural 3D products for supported architecture
- semantic wall joins and host openings
- plan, 3D, elevation, section, and schedule identity linkage
- local render chunks, LOD, CPU/GPU pick paths

Gate:

- section geometry comes from the canonical model, not shader clipping alone
- wall and opening identity survive regeneration
- invalid geometry fails visibly without corrupting document

### Phase D: B-Rep, formats, and rule framework

Build:

- geometry kernel adapter selected by corpus and licence evaluation
- advanced Boolean/section path with diagnostics
- scoped IFC import/export and DXF subset
- versioned rule pack engine, report UI, and IDS integration evaluation

Gate:

- B-Rep failure corpus has controlled outcomes
- capability matrix matches goldens
- rule reports always identify version, source, scope, and revision

### Phase E: Collaboration and professional scale

Build:

- durable operation-log sync, server validation, presence, comments, branches/options
- conflict resolution flows for semantic edits
- large-model benchmark optimisation, job prioritisation, and resource budgets
- enterprise permission/audit controls where required

Gate:

- offline/reconnect/concurrent edit traces converge deterministically
- semantic conflicts are visible and recoverable
- collaboration cannot publish an invalid canonical revision

### Phase F: Optional advanced capabilities

Only after demonstrated product demand:

- parametric sketches and richer solver support
- conceptual massing and site/sun/zoning workflows
- analysis connectors
- a licensed DWG capability
- public plugin SDK with sandboxing/versioning
- specialised AI-assisted layout previews

## 15. Acceptance standard for every feature

No feature is complete until it has:

- semantic schema and migration impact
- typed command and undo policy
- dependency, constraint, and host-relation behaviour
- units, coordinate frame, and tolerance treatment
- worker cancellation, error, and stale-result behaviour
- index and render invalidation rules
- accessibility and keyboard behaviour where user-facing
- deterministic and adverse-input tests
- observability metrics
- explicit import/export and collaboration scope

## 16. Production reference implementations

| Reference | Purpose |
| --- | --- |
| **reference/dependency-graph.ts** | Dirty-closure topological evaluation for directed derivations |
| **reference/snap-engine.ts** | Plan-view broad-phase contract and deterministic snap ranking |
| **reference/coordinates.ts** | float64 canonical positions and local float32 packing |
| **reference/worker-protocol.ts** | Revisioned typed worker messages and safe transferable-buffer handling |
| **reference/webgpu-render-origin.ts** | Camera-independent render chunks and optional high/low coordinate split |
| **reference/high-low-render-origin.wgsl** | Correctly framed optional high/low WGSL vertex path |
| **reference/semantic-operations.ts** | CRDT-agnostic semantic operation log and deterministic rebuild boundary |
| **reference/rule-engine.ts** | Jurisdiction/version-aware rules engine contract |
| **reference/picking-contract.ts** | Revision-matched semantic pick resolution and WebGPU-aligned ID readback layout |
| **reference/selection-id-pass.wgsl** | First-layer and inspect-through semantic ID shader entry points |
| **reference/deferred-csg-session.ts** | Preview, commit, derived-job, cancellation, and stale-result state machine |
| **reference/native-desktop-port.ts** | Browser-first desktop capability boundary with a native-shell adapter seam |
| **reference/quantity-draft.ts** | Controlled typed quantity draft that preserves incomplete input outside canonical state |

These are reference contracts. Integrate them with the actual application schema rather than treating a sample type as a substitute for product modelling decisions.

## 17. Explicit non-claims

Arq does not claim:

- native f64 GPU arithmetic in WebGPU/WGSL
- zero-error floating-point computation
- a full replacement for every desktop AEC/CAD workflow in the first releases
- universal 120 FPS or sub-500 ms opening time independent of model/device
- zero collaboration conflicts
- generic correct OBC, IBC, or zoning compliance without an approved scoped rule pack
- complete IFC 4.3, STEP, DXF, or DWG fidelity without published coverage
- that a mesh Boolean preview is equivalent to an accepted B-Rep product

These limits make the product more trustworthy, not less ambitious.

## 18. Public source material

This specification uses public sources for platform and interoperability constraints:

- [WebGPU specification](https://www.w3.org/TR/webgpu/)
- [WGSL specification](https://www.w3.org/TR/WGSL/)
- [Three.js WebGPURenderer documentation](https://threejs.org/docs/pages/WebGPURenderer.html)
- [Loro documentation](https://loro.dev/)
- [Open CASCADE Boolean operations](https://dev.opencascade.org/doc/overview/html/specification__boolean_operations.html)
- [Open CASCADE licensing](https://dev.opencascade.org/resources/licensing)
- [IFC 4.3.2 documentation](https://ifc43-docs.standards.buildingsmart.org/)
- [buildingSMART IDS](https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/)
- [Autodesk RealDWG API overview](https://aps.autodesk.com/developer/overview/realdwg-api)
- [MDN SharedArrayBuffer requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- [Tauri v2 configuration reference](https://v2.tauri.app/reference/config/)
- [window-vibrancy documentation](https://docs.rs/window-vibrancy/latest/window_vibrancy/fn.apply_vibrancy.html)
- [WAI-ARIA modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [MDN Content Security Policy reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)

Reconfirm package versions, browser compatibility, licensing, code editions, and official rule sources at implementation and release time.

## 19. Implementation deep-dive amendments

The later supplied deep dives add valuable goals: non-modal work, inspect-through selection, deferred CSG previews, spatial option ghosts, native desktop packaging, and polished contextual controls. Their raw samples must be interpreted through the following accepted contracts.

| Area | Accepted implementation decision |
| --- | --- |
| Normal selection | GPU ID picking is an optional accelerator with a CPU fallback and a revision-matched draw-ID-to-semantic-target table |
| Inspect through | Use a capped, cursor-scissored depth-peel stack only on explicit intent. Ping-pong depth targets and resolve returned draw IDs semantically |
| GPU readback | Obey the 256-byte WebGPU row alignment, use a bounded staging-buffer ring, and discard stale responses |
| Dragging and CSG | Render a provisional proxy during direct manipulation; commit one semantic transaction; derive CSG asynchronously with revision/signature guards |
| Non-modal diagnostics | Keep the user in flow with ghost guides and recovery actions, but never commit an invalid semantic document |
| Branch overlays | Render frozen comparison revisions as labelled ghost packets; merge semantic operations through normal validation |
| Native desktop | Treat Tauri as an optional WebView shell with capability adapters, security review, and browser fallback, not as an automatic direct-Metal renderer |
| Contextual UI | Use platform-adaptive visuals with focus, keyboard, touch, contrast, reduced-motion, and controlled quantity-input requirements |
| Spatial acceleration | Use a real, benchmarked R-tree or BVH by purpose. A linear Vec scan is not a BVH or ray caster |

See [ARQ_IMPLEMENTATION_DEEP_DIVE.md](ARQ_IMPLEMENTATION_DEEP_DIVE.md), [ARQ_ULTIMATE_MASTER_SPECIFICATION.md](ARQ_ULTIMATE_MASTER_SPECIFICATION.md), and ADRs 007 through 009 for the detailed contracts.

## 20. UI interaction system amendments

The supplied UI playbook correctly prioritizes cursor-local editing, inline quantity adjustment, command-driven work, non-modal diagnostics, and careful visual optics. The product must not trade semantic correctness or accessibility for animation polish.

| UI concern | Required contract |
| --- | --- |
| Contextual HUD | Presentation-only placement with pointer-safe passive regions, viewport collision avoidance, focus freeze, and a keyboard/touch Inspector equivalent |
| Quantity entry | Controlled string draft separated from canonical quantities; finite, domain-valid commit only; Escape cancels |
| Numeric scrubber | Pointer previews update a proxy; pointer release produces one proposal and one possible undo record |
| Command palette | Opens explicitly, manages focus and IME input, and returns typed proposals rather than direct model callbacks |
| Diagnostic quick fix | Valid only at the diagnostic source revision, then routes through normal transaction validation |
| Glass and squircle visuals | Opaque contrast-safe baseline; blur and corner-shape enhancement are capability- and performance-gated |
| Spring and velocity tilt | Optional, capped, and disabled under reduced motion or active text editing |

The detailed implementation and test gates live in [ARQ_UI_UX_SYSTEM_SPECIFICATION.md](ARQ_UI_UX_SYSTEM_SPECIFICATION.md). The associated decisions are [ADR-010](decision_records/ADR-010-unified-contextual-interaction-boundary.md) and [ADR-011](decision_records/ADR-011-progressive-accessible-surface-and-motion-system.md).

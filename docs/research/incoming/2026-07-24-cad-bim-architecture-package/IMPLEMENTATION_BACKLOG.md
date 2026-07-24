# Arq CAD/BIM Engine Implementation Backlog

This backlog is deliberately ordered to prevent a polished renderer from becoming the accidental model database.

## Operating rules

1. No feature may write directly to renderer objects as model truth.
2. No geometry job may publish output without matching document revision and input signature.
3. No persisted document may depend on transient kernel handles, GPU IDs, or cached mesh buffers.
4. Every mutation is a typed transaction with an explicit success or rejection result.
5. Every feature ships with adverse-input tests, not just a happy-path demo.

## Delivery order

| Order | Epic                                                    | Why it comes now                                             |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------ |
| 0     | Architecture baseline                                   | Prevents irreversible data-model mistakes                    |
| 1     | Semantic document and persistence                       | Creates durable source of truth                              |
| 2     | Transactions and model-worker protocol                  | Makes edits reliable before geometry grows                   |
| 3     | Coordinates, units, and tolerances                      | Prevents large-site and import debt                          |
| 4     | Derivation DAG and formula service                      | Enables correct propagation                                  |
| 5     | Plan primitives, spatial index, and snapping            | Delivers the first excellent editing experience              |
| 6     | Deterministic 2.5D architecture builder                 | Produces useful model geometry without premature B-Rep scope |
| 7     | Renderer adapter and multi-view caches                  | Makes presentation disposable and fast                       |
| 8     | Kernel adapter and measured B-Rep spike                 | Adds advanced geometry only after the foundations work       |
| 9     | Import/export subsets                                   | Adds interoperability with an honest capability boundary     |
| 10    | Reliability, performance, and collaboration foundations | Hardens a working engine                                     |

## Epic 0: Architecture baseline

### Build

- Create the domain package boundary: document, commands, geometry adapter, renderer adapter, importer adapter, and persistence adapter.
- Adopt a schema validation library or explicit runtime validators at every external boundary.
- Add a feature/capability registry that distinguishes enabled, experimental, supported, and unsupported behaviour.
- Add a structured diagnostic model and error code taxonomy.
- Add test fixtures folder conventions and a replay-test harness.

### Do not build

- renderer-specific domain data
- direct calls from React components into a geometry kernel
- a universal model object with optional fields for every element kind

### Done when

- a minimal command can traverse UI bridge -> model worker -> transaction result without browser-specific objects in the message
- a fixture can be replayed twice with byte-equivalent canonical JSON output
- a deliberately malformed command returns a structured rejection, not an exception crossing the worker boundary

## Epic 1: Semantic document, IDs, and persistence

### Build

- Document root with schema version, document ID, revision, units, tolerances, coordinate policy, elements, types, relations, and property sets.
- Stable ID generation policy.
- Element envelopes and initial typed elements: project, building, level, grid, wall, wall type, opening, door, window, material, and annotation.
- First-class host, containment, type, and source-provenance relations.
- Deterministic serialisation and migration pipeline.
- Snapshot plus command-log local persistence.

### Acceptance scenarios

| Scenario                                     | Expected result                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| Save and restore a wall with a hosted window | Same stable IDs, parameters, relations, and revision history semantics        |
| Load a prior schema fixture                  | Deterministic migration plus migration report                                 |
| Load a future schema fixture                 | Read-only or guarded path; unknown fields not silently destroyed              |
| Delete a host wall                           | Defined policy moves, deletes, or invalidates hosted opening with diagnostic  |
| Duplicate a wall type                        | New type ID, occurrences stay attached to original unless commanded otherwise |

### Done when

- no renderer or kernel object is serialised
- all element references validate
- undo-relevant commands can be stored and replayed
- corruption recovery chooses the last valid snapshot rather than partial data

## Epic 2: Model worker, transactions, undo, and revisions

### Build

- One authoritative model worker per open document.
- Versioned request/response protocol based on the reference file.
- Isolated staging transaction state.
- Validation layers: schema, permission, reference, domain, formula, and geometry-result acceptance.
- Revision assignment only on atomic commit.
- Undo/redo grouping and semantic inverse policy.
- Cancellation and stale-result rules for long jobs.

### Acceptance scenarios

| Scenario                                             | Expected result                                            |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| Submit command against old base revision             | Rejected with STALE_BASE_REVISION and current revision     |
| Invalid host assignment                              | Entire transaction rejected; document unchanged            |
| Drag emits 200 preview updates and one final command | Exactly one user undo entry                                |
| Undo while tessellation is active                    | New revision commits; old tessellation result is discarded |
| Browser reload during autosave                       | Load last coherent revision or prior valid revision        |

### Done when

- every response has a request ID and document revision context
- a transaction cannot partially update element, relation, and index state
- undo/redo never rewrites revision numbers backward

## Epic 3: Units, coordinate frames, and tolerance policy

### Build

- Canonical metre/radian internal representation.
- Display-unit conversion and rounding service.
- Georeference, project, building, level, element, and profile frame definitions.
- Finite-number validation at command and import boundaries.
- Render-origin selection policy.
- One versioned tolerance policy shared by geometry, snapping, import, and validation.

### Acceptance scenarios

| Scenario                                    | Expected result                                                    |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Model contains large geographic coordinates | Local building edits and rendering remain stable                   |
| Import with millimetres                     | Values convert once and preserve physical size                     |
| Change display units                        | Canonical model unchanged; only labels and input formatting change |
| Non-finite coordinate arrives from importer | Transaction rejects with diagnostic                                |
| Render origin changes while panning         | GPU cache invalidates, document revision does not change           |

### Done when

- any element position can be traced to a named coordinate frame
- no default epsilon is hidden in feature code
- large-coordinate visual regression passes on target devices

## Epic 4: Derivation, formulas, and constraints

### Build

- Directed derivation graph using dirty closure.
- Restricted formula AST with units and dependency references.
- Explicit constraint-group service; begin with a small supported set.
- Derived product signatures and cache invalidation graph.
- Human-readable cycle and over-constraint diagnostics.

### Acceptance scenarios

| Scenario                                             | Expected result                                            |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| Raise a level controlling a wall and hosted door     | All downstream products update in dependency order         |
| Formula A -> B -> C -> A                             | Transaction rejects with cycle path                        |
| Equal-distance constraint conflicts with fixed value | Solver returns over-constraint diagnostic; no partial move |
| Change one wall in a large model                     | Only downstream affected derivations recompute             |

### Done when

- the graph tests include missing dependency, self-cycle, multi-node cycle, and downstream closure
- constraint solve and DAG errors have different error codes
- formula evaluation cannot execute arbitrary JavaScript

## Epic 5: Plan primitives, index, selection, and snapping

### Build

- Revisioned 2D primitive extraction for walls, grids, openings, and dimensions.
- Real 2D R-tree or a benchmarked equivalent for bounding boxes.
- Active work-plane and screen-to-model conversion.
- Snap candidates: endpoint, intersection, midpoint, nearest; add perpendicular/tangent only with tests.
- Deterministic priority/ranking and snap glyph feedback.
- CPU semantic hit test and optional GPU ID acceleration.
- One-layer GPU ID pass with revision-matched draw-ID-to-semantic-target resolution.
- Explicit, capped inspect-through selection with scissoring, depth-target ping-pong, and a 256-byte-aligned staging-buffer ring.

### Acceptance scenarios

| Scenario                                            | Expected result                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Dense plan and fast pointer move                    | Query remains bounded; no full-scene scan                                      |
| Two equally close targets                           | Deterministic target based on declared precedence and stable tie-break         |
| Zoom in/out                                         | Same visual snap tolerance in pixels                                           |
| Hidden or locked layer                              | Excluded according to visible command policy                                   |
| Near-parallel segments                              | No false intersection or NaN                                                   |
| Large coordinates                                   | Snap point stays stable                                                        |
| Renderer packet rebuild during an asynchronous pick | Stale GPU readback is discarded and cannot select a different semantic element |
| Inspect-through on a curtain wall                   | Ordered semantic candidates follow the declared category policy                |

### Done when

- nearest distance is reported in pixels, not world units
- candidate result does not depend on R-tree traversal order
- index revision always matches query snapshot
- plan view supports keyboard-only precise input in addition to pointer snapping
- inspect-through selection is explicit, bounded, and has a keyboard-accessible equivalent

## Epic 6: Deterministic 2.5D architecture builder

### Build

- Procedural generation for walls, layer stacks, slabs, simple columns, openings, doors, and windows.
- Wall path model, location line, base/top constraints, and explicit join policy.
- Host-child placement local to host.
- Section and elevation primitives for supported objects.
- Geometry validation before render packet creation.

### Acceptance scenarios

| Scenario                        | Expected result                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Move a wall containing a window | Window remains hosted and moves by defined local placement rule                    |
| Change level height             | Wall and opening update without identity replacement                               |
| Two walls join                  | Result follows declared join policy and emits limitation diagnostic if unsupported |
| Delete opening                  | Host wall regenerates cleanly                                                      |
| Invalid opening outside host    | Reject or show unresolved state, never silently corrupt geometry                   |

### Done when

- all common building elements derive from semantic parameters
- renderer mesh can be deleted and recreated without data loss
- section view is generated from canonical geometry, not a screenshot or clip-only effect

## Epic 7: Renderer adapter and view cache system

### Build

- Renderer adapter with WebGL2 baseline and capability-based WebGPU path.
- Local-origin typed mesh packets.
- Render packet lifecycle, caching, transfer ownership, disposal, and revision guards.
- Plan, 3D, and section view contracts.
- Screen-space lines, labels, selection, visibility filters, and basic level of detail.
- GPU ID picker as an optional accelerator with CPU fallback.
- Deferred preview products, non-modal diagnostics, and revision/signature-guarded geometry job acceptance.

### Acceptance scenarios

| Scenario                                    | Expected result                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Old render packet arrives after undo        | Packet is ignored                                                                              |
| Change render origin                        | Scene buffers rebuild without model mutation                                                   |
| Thin line is selected                       | CPU fallback finds semantic target                                                             |
| OffscreenCanvas unsupported                 | Main-thread renderer still works                                                               |
| WebGPU unavailable                          | WebGL2 path remains feature-complete for core editing                                          |
| Drag wall/opening while CSG work is pending | Preview remains responsive; exactly one semantic commit occurs; stale geometry never publishes |

### Done when

- view state never leaks into the saved semantic document
- every draw packet includes geometry revision and render origin
- render memory is bounded and released after view/document close
- contextual editing controls preserve drafts, support keyboard/touch use, and do not mutate canonical quantities with incomplete or invalid input

### Epic 7A: Contextual interaction and accessible surface system

### Build

- Quantity-editor bridge using controlled drafts, display-unit parsing, validation, commit, and Escape cancellation.
- Pointer-captured numeric scrub sessions that preview locally and create one semantic proposal on release.
- Contextual HUD placement with safe-area constraints, protected-rectangle avoidance, passive canvas hit region, and input-focus freeze.
- Command palette state with explicit opening, focus restoration, IME-aware key handling, accessible command rows, deterministic ranking, and proposal creation.
- Persistent diagnostic model, dismissible presentation state, revision-guarded quick-fix proposals, and accessible status reporting.
- Opaque baseline surfaces, progressive blur and corner-shape enhancement, icon accessibility rules, and reduced-motion/high-contrast tokens.

### Acceptance scenarios

| Scenario                                     | Expected result                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Type an incomplete or invalid length         | Draft remains editable; canonical property does not change                          |
| Press Escape in a quantity field             | Original displayed value returns and no transaction commits                         |
| Scrub a wall height across 200 pointer moves | Proxy updates continuously; one undoable transaction is proposed at pointer release |
| HUD is visible during canvas pan             | Passive HUD area does not block pan, orbit, snapping, or context menu               |
| Press Cmd+K from the canvas                  | Palette opens, focus moves to search, and Escape returns focus to the invoker       |
| Press Enter while composing IME text         | No command is executed                                                              |
| Dismiss a persistent egress diagnostic       | Chip may disappear, but issue remains listed and visible on the element             |
| Apply a quick fix after a remote edit        | Stale result is rejected and diagnostic is re-evaluated                             |
| Disable motion or use high contrast          | Controls remain legible, operable, and free of nonessential animation               |

### Done when

- all contextual controls submit typed proposals through the model-worker transaction gateway
- no pointer-preview event writes canonical document state
- accessible tests cover palette, HUD controls, diagnostics, and focus restoration
- visual regression tests cover opaque fallback, blur capability, and device-pixel-ratio icon rendering
- performance trace confirms small overlay effects do not violate the view frame budget

## Epic 8: Kernel adapter and B-Rep decision spike

### Build

- GeometryKernel adapter, job scheduler, cancellation, and structured kernel diagnostic mapping.
- A small corpus for booleans, sectioning, validation, and tessellation.
- At least two candidate implementations or one candidate plus a documented baseline to prevent false confidence.
- License, source attribution, build reproducibility, binary size, memory, and browser support record.

### Acceptance scenarios

| Scenario                         | Expected result                                  |
| -------------------------------- | ------------------------------------------------ |
| Valid opening Boolean            | Accepted only after validation                   |
| Coincident or invalid Boolean    | Controlled error and preserved last valid model  |
| User edits source during Boolean | Prior result discarded as stale                  |
| Cancel large Boolean             | Job resolves as cancelled and releases resources |
| Kernel upgrade                   | Fixture corpus identifies changed behaviour      |

### Done when

- the selected kernel passes the agreed corpus on target devices
- no kernel object handle appears in persisted model state
- production build has a tested non-crashing error path for kernel failures

## Epic 9: Interoperability

### Build

- Published IFC entity/property capability matrix.
- Import parser worker, source provenance, conversion report, and unsupported-feature report.
- IFC subset import/export golden fixtures.
- Scoped DXF reader/writer only for supported 2D primitives.
- A separate decision record for any DWG capability.

### Acceptance scenarios

| Scenario                                  | Expected result                                                 |
| ----------------------------------------- | --------------------------------------------------------------- |
| Import supported IFC wall and opening     | Native semantic elements and relations created                  |
| Import unsupported IFC class              | Preserved/recorded according to policy, with visible diagnostic |
| Export/import native supported model      | Semantics pass golden comparison                                |
| Import DXF with unsupported custom entity | Explicit unsupported warning, no silent data invention          |
| Import malformed file                     | Worker error, UI remains responsive, document unchanged         |

### Done when

- every public format claim links to a verified fixture set
- user receives a conversion report
- unknown source content is not falsely reported as edited with fidelity

## Epic 10: Reliability, performance, and collaboration foundations

### Build

- benchmark corpus and dashboard
- deterministic replay tests
- fuzz and adversarial import/geometry test job
- crash recovery drills
- feature flags and capability telemetry
- server-backed document revisions, auth, presence, and conflict protocol

### Acceptance scenarios

| Scenario                                 | Expected result                                       |
| ---------------------------------------- | ----------------------------------------------------- |
| Reproduce a reported failure             | Replay from command log and fixture                   |
| Large import                             | Progress, cancellation, memory cap, no frozen UI      |
| Two users edit same host relation        | Explicit conflict or lock, never silent invalid merge |
| Cross-origin isolation cannot be enabled | Transferable-buffer mode works                        |
| Visual test changes cut line style       | Diff identifies it before release                     |

### Done when

- release candidate passes deterministic, geometry, import, visual, and performance gates
- no release relies on a single browser feature without fallback
- collaboration server validates semantic commands before publishing revision

## First implementation slice: the narrowest credible product

Build this before any full B-Rep investment:

1. Open a document with project, two levels, one wall type, and walls.
2. Draw and edit wall paths in plan with endpoint/midpoint/intersection/nearest snap.
3. Set base/top constraints to levels.
4. Generate 2.5D wall representation and show it in a second 3D view.
5. Save, reload, undo, redo, and replay the document deterministically.
6. Change a level, then prove every dependent wall updates while stale render jobs are rejected.

If this slice is solid, Arq has the right spine. If it is not solid, adding a geometry kernel will make debugging much harder.

## Release checklist

Before calling any CAD/BIM capability supported:

- [ ] Document schema version and migration test exist.
- [ ] Command and undo policy are documented.
- [ ] Coordinate frame and tolerance policy are explicit.
- [ ] Derived dependency and constraint behaviour are tested.
- [ ] Stale worker output cannot commit.
- [ ] Index, render cache, and import revision rules are tested.
- [ ] Failure state is user-visible and recoverable.
- [ ] Performance result exists for the benchmark corpus.
- [ ] Licence and source attribution review is complete.
- [ ] Format support claim is backed by golden fixture coverage.

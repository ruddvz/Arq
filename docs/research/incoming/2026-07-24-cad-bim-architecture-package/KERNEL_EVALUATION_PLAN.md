# Geometry Kernel Evaluation Plan for Arq

## Purpose

Choose a geometry kernel from evidence, not from a feature list. A kernel that can create a cylinder in a demo may still fail the operations that matter for Arq: host openings, near-coincident architectural geometry, predictable cancellation, memory limits, browser builds, and licensing.

This plan evaluates a candidate behind the Arq GeometryKernel adapter. It does not let a candidate kernel dictate Arq's document schema or public product scope.

## 1. Candidate categories

| Category | Example | Evaluate for | Do not assume |
| --- | --- | --- | --- |
| Full B-Rep kernel | Open CASCADE Technology | trimmed analytic geometry, STEP, sections, Booleans | easy WASM build, low memory, perfect booleans |
| Mesh Boolean kernel | Manifold | fast solid mesh operations, reliable manifold output | analytic surfaces, NURBS, B-Rep identity |
| Computational-geometry library | CGAL components | selected algorithms and predicates | permissive licence for every component |
| Rust B-Rep stack | Truck or equivalent | Rust/WASM ergonomics and early web-native work | mature AEC interchange or production robustness |

## 2. Non-negotiable adapter contract

Before running a candidate, implement or stub this contract:

~~~typescript
interface GeometryKernel {
  build(request: BuildRequest): Promise<KernelResult>;
  boolean(request: BooleanRequest): Promise<KernelResult>;
  tessellate(request: TessellationRequest): Promise<MeshPacket>;
  slice(request: SliceRequest): Promise<SectionPacket>;
  validate(request: ValidationRequest): Promise<ValidationReport>;
  dispose(handle: GeometryHandle): Promise<void>;
}
~~~

Required behaviours:

- every request carries document revision, input signature, tolerance policy, cancellation token, and memory/time budget
- every result is structured success, failure, cancelled, or unsupported
- no native handle is persisted outside the geometry worker
- no result is accepted after its revision or signature is stale
- kernel errors are converted into diagnostic codes

## 3. Test corpus

Store every fixture and expected status in source control. Use small parameterised models rather than only screenshots.

### 3.1 Primitive and profile construction

- line, arc, circle, ellipse, spline, planar profile with holes
- rectangular and curved wall paths
- extrude, revolve, sweep, offset, and shell only if product scope requires them
- valid and invalid profile orientation
- tiny but valid features near tolerance limits

### 3.2 Architectural host openings

- one rectangular door opening in a straight wall
- multiple windows close together
- window near wall endpoint
- opening spanning a wall join
- opening outside host bounds
- opening only just touching host face
- delete and reinsert opening
- move host with child placement preserved

### 3.3 Boolean adversarial cases

- coplanar faces
- coincident faces
- tangent solids
- near-tangent solids
- narrow sliver intersection
- non-manifold input
- self-intersecting input
- invalid orientation
- large coordinates with small feature
- repeated identical operation for determinism

### 3.4 Sections and tessellation

- horizontal plan cut
- vertical section through opening
- section grazing a face/edge/vertex
- smooth curved surface at near and far camera distance
- requested tessellation quality changes
- render-origin changes

### 3.5 Import geometry

- supported IFC representation examples
- STEP primitives and trimmed surfaces if in scope
- malformed files
- unsupported representation items
- units and coordinate transforms

## 4. Evaluation dimensions

Score each candidate from tested evidence. A candidate can fail outright even with a high aggregate score if it fails any hard gate.

| Dimension | What to measure |
| --- | --- |
| Correctness | Expected geometry/diagnostic result, valid topology, deterministic repeat |
| Robustness | Controlled outcomes for malformed and near-degenerate input |
| Interoperability | Required STEP/IFC geometry coverage and conversion fidelity |
| Browser viability | Build repeatability, worker startup, supported browsers, asset size |
| Memory | Peak and retained memory across repeated operations and disposal |
| Latency | Cold start, common build, Boolean, tessellation, and cancellation latency |
| Cancellation | Time to observe cancellation and cleanup resources |
| Diagnostics | Error specificity and ability to identify source elements |
| Maintainability | API stability, release cadence, wrapper complexity, testability |
| Licence | Exact version terms, distribution obligations, source notices, commercial option |
| Security | Parser surface, native code exposure, update/patch process |

## 5. Hard gates

A candidate is ineligible for production if any of the following is true:

- no reproducible browser/WASM build
- cannot run in a worker with bounded failure behaviour
- leaks memory materially during repeated build/tessellate/dispose cycles
- makes worker or tab unresponsive on an agreed adversarial fixture
- cannot report a structured error for invalid Boolean input
- cannot preserve model isolation after a failed job
- licence obligations cannot be met for the intended distribution model
- required browser support is absent and no fallback is approved

## 6. Benchmark procedure

### Environment record

For every run, record:

- candidate name, source commit, wrapper version, and compiler flags
- browser and version
- operating system, CPU, memory, GPU, and device tier
- cross-origin isolation and WASM-thread flags
- fixture revision and tolerance policy
- cold versus warm cache

### Measurement rules

- run a warm-up pass before timed repeats
- report median, 95th percentile, max, and failure count
- track peak memory and retained memory after dispose
- retain raw logs and structured result JSON
- rerun a failing case with deterministic seed and capture diagnostic
- never compare a mesh-only result to a B-Rep result without recording the semantic difference

### Required stress loops

- 100 repeated wall-build/tessellate/dispose cycles
- 100 valid opening booleans
- 100 invalid or near-coincident booleans
- rapid edit/cancel/restart sequence
- document close while job is active
- worker restart and document reload

## 7. Browser deployment checks

Validate:

- ordinary transferable ArrayBuffer path
- SharedArrayBuffer/WebAssembly-thread path only if enabled
- cross-origin-isolated deployment assets and embeds
- CSP, worker URL, and WASM asset loading
- worker termination and restart
- browser memory-pressure behaviour
- fallback rendering path

Do not make a cross-origin-isolated deployment the first operational test. It can affect fonts, images, iframes, analytics, and other external resources.

## 8. Licensing checklist

For the exact candidate version:

- [ ] Record SPDX identifier and licence text.
- [ ] Record static versus dynamic/WASM linking implications.
- [ ] Record any additional exception or commercial agreement.
- [ ] Preserve notices and attribution in distribution.
- [ ] Review modifications to candidate source.
- [ ] Review dependencies and transitive licences.
- [ ] Obtain legal sign-off for product distribution model.
- [ ] Record update process for vulnerability fixes.

An engineering feature matrix is not a licence decision.

## 9. Decision meeting output

The final decision record must contain:

1. selected candidate and exact version
2. rejected candidates and evidence
3. pass/fail matrix for every hard gate
4. known unsupported operations
5. licence decision and owners
6. build/release plan
7. required fallbacks
8. migration/escape plan if the candidate becomes unsuitable

## 10. Recommended initial conclusion

Do not choose a full B-Rep kernel as the prerequisite for Phase 1. Use semantic procedural architecture builders first. Run this plan in parallel. Select a B-Rep kernel only when the evaluated corpus proves it improves required Arq workflows without compromising browser reliability, legal clarity, or the semantic data model.

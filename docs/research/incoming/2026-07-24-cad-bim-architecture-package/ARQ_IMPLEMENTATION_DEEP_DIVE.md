# ARQ: Core Engine Implementation Deep Dive

## Corrected depth-peeling selection, desktop-shell boundary, and adaptive design-system contract

> **Status:** Implementation-ready reference specification. It is deliberately not a drop-in application because no Arq repository, package versions, platform targets, or test corpus have been supplied. Integrate these contracts behind the revisioned model-worker protocol already defined in this package.

This document consolidates the supplied deep-dive and Ultimate specification into a buildable direction. It preserves the important product goals: inspect-through selection, immediate dragging, non-modal diagnostics, spatial options, contextual controls, and a polished desktop experience. It corrects the portions that would otherwise fail at runtime, overpromise performance, or compromise accessibility and model integrity.

Normative product and model decisions remain in [ARQ_MASTER_TECHNICAL_SPECIFICATION.md](ARQ_MASTER_TECHNICAL_SPECIFICATION.md). This document owns the implementation boundary for selection, deferred CSG, desktop shells, and interaction components.

## 1. Decision summary

| Supplied idea | Accepted direction | Important correction |
| --- | --- | --- |
| N-pass depth peeling on hover | Use a normal one-layer semantic ID pick by default; expose a capped inspect-through stack only by explicit intent such as Option/Alt | A full N-pass viewport render and asynchronous readback on every pointer movement is an avoidable latency and battery cost |
| GPU entity ID is the selected object | GPU returns a packet-local draw ID which is resolved through a revision-matched semantic table | Draw IDs, buffer offsets, and mesh indices are never durable BIM identities |
| Fixed depth epsilon | Derive a bounded peel tolerance from camera projection, depth convention, document tolerance, and measured fixtures | One NDC constant cannot be reliable over all scales, projections, or camera planes |
| Heavy Boolean runs after a hard-coded debounce | Drag produces a lightweight preview; a single semantic command commits on intentional checkpoint; a revisioned worker job derives CSG after commit | Results must be rejected when their revision or input signature is stale |
| No modal dialogs | Use non-modal diagnostics, ghost previews, and recovery actions | An invalid state still must not be silently committed to the canonical model |
| Tauri plus Metal backend | Treat Tauri as a desktop WebView shell for the same browser renderer | Tauri does not by itself turn a WebGPU application into a custom direct-Metal renderer |
| Apple-grade UI | Use platform-adaptive, high-quality controls with progressive visual enhancements | Accessibility, contrast, motion preference, focus handling, and input correctness are mandatory |
| Rust SIMD BVH sample | Require a real packed BVH or R-tree with benchmarked query methods before calling it an acceleration structure | A Vec scan is O(N), not a BVH, not SIMD, and not a ray cast |
| Zero-cost CRDT branches | Store branch/checkpoint operation sets and render frozen comparison revisions as ghosts | CRDT convergence and branch merging still require semantic validation |

## 2. Interaction system

### 2.1 Selection modes

Arq has three deliberately different selection paths:

| Mode | Invocation | Fast path | Result |
| --- | --- | --- | --- |
| Hover feedback | Pointer movement | CPU spatial index, recent GPU result, or both | A provisional semantic candidate and HUD |
| Normal selection | Click/tap | One semantic GPU ID pass plus model-space validation | One selected target |
| Inspect through | Explicit Option/Alt gesture, layer control, or accessibility-equivalent command | Capped, cursor-scissored depth-peel stack | Ordered list of semantic candidates under the cursor |

The normal pick has a predictable first-click result. The inspect-through mode makes occlusion explicit rather than forcing invisible tab cycles. The UI must expose a keyboard-accessible control in addition to a modifier gesture.

### 2.2 Selection lifecycle

~~~mermaid
sequenceDiagram
  participant UI as UI and pointer
  participant Render as Renderer
  participant Model as Model worker

  UI->>Render: Request selection stamped with render revision
  Render->>Render: Resolve draw IDs in matching packet table
  Render->>UI: Candidate semantic targets
  UI->>Model: Validate final semantic target and current revision
  Model->>UI: Selection accepted or changed-state diagnostic
~~~

The renderer owns the draw-ID table for a render packet. The model worker owns the semantic element and checks that the target remains valid if a command follows selection. A selection result that arrives after the render revision changes is ignored.

### 2.3 First-layer ID pass

For normal selection, render selectable opaque proxy geometry into:

- an r32uint color target containing a non-zero draw ID;
- a depth32float depth target used only for depth testing;
- a scissor rectangle around the physical pointer coordinate, preferably one to a few pixels;
- a bounded staging-buffer ring for asynchronous readback.

ID 0 represents no candidate. The engine must retain a table:

~~~text
draw ID -> { semantic element ID, optional semantic subelement, source render revision }
~~~

The WGSL reference at [reference/selection-id-pass.wgsl](reference/selection-id-pass.wgsl) contains separate first-layer and peel fragment entry points. The TypeScript contract at [reference/picking-contract.ts](reference/picking-contract.ts) defines physical-pixel conversion, WebGPU readback alignment, stale-result handling, and semantic resolution.

### 2.4 Inspect-through depth peeling

Depth peeling is an explicit drill-down tool, not the universal hover implementation.

1. Render the visible selection layer into ID target L0 and depth target D0.
2. For layer Ln, bind D(n-1) as a sampled depth texture and render to fresh ID/depth targets Ln and Dn.
3. The peel fragment discards a fragment only when it is at or in front of the prior layer plus the configured view-aware tolerance.
4. Stop at the product cap, normally 3 to 4 layers, a time budget, a background ID, or a repeated semantic target.
5. Copy only the cursor pixel from each ID target into a reusable staging buffer. Resolve the returned draw IDs through the revision-matched map.

Depth targets must ping-pong. A texture may not be sampled while it is bound as the active render attachment. Use the WGSL depth-texture type rather than treating a depth32float attachment as an ordinary sampled float texture. WGSL explicitly defines depth texture types and their separate access model, while WebGPU requires bytesPerRow to be a multiple of 256 for texture-to-buffer copies. See the [WGSL specification](https://www.w3.org/TR/WGSL/) and [WebGPU specification](https://www.w3.org/TR/webgpu/).

#### Correct asynchronous readback pattern

The supplied controller allocated four bytes then requested a 256-byte row. That is invalid. Use this sequence:

1. Reserve a completed slot from a small staging-buffer ring.
2. Allocate or reuse 256 multiplied by layerCount bytes. The contract computes this layout.
3. Record all copyTextureToBuffer operations with offsets layerIndex multiplied by 256, bytesPerRow 256, and a 1-by-1 extent.
4. Submit once, map once after completion, and read the first Uint32 at each 256-byte layer offset.
5. Unmap and return the slot to the ring.

Do not create, map, and destroy a buffer for every layer or pointer event. Rate-limit inspect-through requests, cancel superseded requests logically with a request stamp, and render hover feedback from the CPU index while GPU confirmation is pending.

#### Transparency and semantic priority

Transparency is not an implicit selection rule. Each selectable category declares one of:

- **occluding**: participates in normal depth selection;
- **inspectable overlay**: appears in the layer list but does not block the first target;
- **non-selectable presentation**: annotations, effects, and helpers never become a primary target;
- **semantic proxy**: renders a simpler selection hull that maps to a BIM object or subelement.

The product must publish an ordering policy for assemblies. For example, an Alt inspect stack can list curtain panel, mullion, wall layer, then structural column, instead of returning arbitrary triangles.

### 2.5 Pick tolerance and coordinate integrity

The pick renderer must use the same render origin, local camera frame, and projection convention as its visual renderer. The source model remains float64. GPU positions remain local float32 as defined in [reference/webgpu-render-origin.ts](reference/webgpu-render-origin.ts).

Peel tolerance is a named input to the render packet. It is not a global magic value. Its implementation policy must:

- retain document tolerance separately from depth comparison tolerance;
- account for perspective versus orthographic projection;
- use measured lower and upper bounds;
- avoid skipping thin but valid architectural layers;
- record the value in visual regression fixtures.

## 3. Deferred CSG proxy interaction

### 3.1 Product behaviour

During a drag, users see a fast, clearly provisional proxy. It may be an extruded profile, transformed prior mesh, or generated outline. It must never masquerade as a committed exact B-Rep product.

On pointer release, Enter, or an explicit apply action:

1. The UI emits one semantic command proposal.
2. The model worker validates and atomically commits the semantic edit, or rejects it without changing the canonical document.
3. A geometry worker receives a cancellable derived CSG job containing the committed revision and deterministic input signature.
4. The renderer keeps the preview or the last valid derived product while the job is pending.
5. The result is published only if its revision and signature still match current model state.

The reference state machine is [reference/deferred-csg-session.ts](reference/deferred-csg-session.ts). It intentionally does not own arbitrary setTimeout policy. Scheduling is a product-level budget decision and should be adjusted from telemetry, not represented as a supposedly universal 50 ms or 150 ms constant.

### 3.2 Non-modal failure state

~~~mermaid
stateDiagram-v2
  [*] --> Previewing
  Previewing --> Validating: Commit intent
  Validating --> Baking: Semantic revision accepted
  Baking --> Ready: Derived result matches current inputs
  Validating --> NeedsCorrection: Transaction rejected
  Baking --> NeedsCorrection: Kernel result invalid
  NeedsCorrection --> Previewing: User adjusts proposal
  NeedsCorrection --> [*]: User cancels
  Ready --> [*]
~~~

NeedsCorrection is visible, actionable, and non-modal. It can show a ghost boundary, diagnostic chip, affected elements, suggested safe alternatives, and a return-to-valid command. The model cannot write an invalid persistent state simply because the UI chooses not to show a blocking dialog.

### 3.3 Geometry job acceptance

A CSG result is accepted only if all of the following are true:

- its session, target element, committed revision, and input signature match;
- the target element still exists and remains eligible for the operation;
- topology and product validation passes;
- the result remains within the defined resource budget;
- the result does not supersede a newer job for the same derived product.

This prevents a late opening-cut result from overwriting a wall that a collaborator has subsequently edited.

## 4. Spatial options, branches, and ghost overlays

The goal is valid: designers should compare options in the same spatial context. The implementation is:

1. A branch records a stable base checkpoint plus a semantic operation set.
2. A branch materialises through the same deterministic rebuild and validation process as the active document.
3. A ghost overlay is a revision-pinned, derived render packet with a difference style. It is not a second mutable renderer scene.
4. Merging creates semantic operations that pass the normal transaction, host, constraint, and geometry checks.
5. The compare mode labels the source branch and revision, provides opacity and pattern controls, and has a non-colour-only accessibility treatment.

Do not promise zero-cost branches. A checkpoint and operation history can make branching inexpensive, but materialisation, geometry regeneration, network transfer, and semantic conflict resolution still have costs.

## 5. Worker and acceleration topology

Browser workers are capabilities, not a guaranteed fixed number of OS threads. The authoritative model worker remains serial. Rendering in an OffscreenCanvas worker, WebAssembly threads, and SharedArrayBuffer are optional enhancements gated by browser support and cross-origin isolation.

| Service | Required ownership | Optional implementation |
| --- | --- | --- |
| Main UI | DOM, accessibility, transient tools, presentation state | React, Solid, native desktop webview |
| Model worker | semantic document, revisions, validation, transaction order | one dedicated worker |
| Geometry jobs | B-Rep/procedural derivation, tessellation, sections | bounded worker queue or a single kernel worker |
| Spatial indexes | revision-matched 2D R-tree, mesh BVH, room indexes | JS, Rust/Wasm, or kernel-owned adapters |
| Renderer | local packets, draw IDs, GPU resources | main thread by default; OffscreenCanvas when proven |

### 5.1 Do not misname an O(N) scan

The supplied Rust example maintains parallel vectors and checks every axis-aligned box. That is a linear point-in-AABB scan:

- it is not a hierarchy;
- it is not SIMD merely because Rust can be compiled to Wasm;
- raycast_point is not a ray cast;
- it lacks update strategy, traversal order, ray/triangle narrow phase, quality metric, and rebuild policy.

A real mesh BVH needs packed nodes, hierarchy construction, bounding-box traversal, primitive intersection, and a benchmark against an agreed corpus. A plan-index R-tree needs insert/update/delete/query semantics. Until then, use the existing purpose-specific indexing policy in the master specification.

## 6. Desktop shell and native boundary

### 6.1 What Tauri does and does not do

Tauri v2 is a native application shell hosting a WebView. It can provide native window controls, menus, file-system capabilities, and optional window effects. It does not, by itself, provide a custom direct-Metal renderer to a WebGPU application. The frontend continues to use the WebView graphics implementation. A future direct native renderer is a distinct product and architecture decision.

Tauri documents WebviewWindow as the hosted window abstraction and documents macOS private-API configuration separately. See the [Tauri v2 configuration reference](https://v2.tauri.app/reference/config/) and [WebviewWindow API](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html).

### 6.2 Safe shell contract

The application talks to a small capability port rather than importing private Tauri globals throughout the codebase. [reference/native-desktop-port.ts](reference/native-desktop-port.ts) provides the web fallback interface. The production Tauri adapter belongs in the actual app after:

- pinning a tested Tauri, Rust, and plugin version set;
- declaring least-privilege capabilities for every native command;
- validating signed desktop builds on supported macOS versions;
- providing browser-equivalent fallbacks;
- testing failure paths such as unavailable vibrancy or fullscreen denial.

Calling a Rust command that only emits an fps-changed event does not impose a GPU frame-rate limit. Render cadence is controlled by the web renderer scheduling, display synchronization, frame budget, and quality policy.

### 6.3 macOS transparency and vibrancy

Use optional native window effects as visual enhancement. The Tauri configuration reference warns that macOSPrivateApi enables private APIs for transparent windows and prevents App Store acceptance. Keep it out of the default distributable configuration unless the distribution decision explicitly accepts that trade-off.

The window-vibrancy crate exposes a macOS vibrancy helper, but platform effects should always have a no-effect fallback. See [window-vibrancy documentation](https://docs.rs/window-vibrancy/latest/window_vibrancy/fn.apply_vibrancy.html).

An intentionally conservative configuration sketch is:

~~~json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Arq CAD",
  "identifier": "app.arq.cad",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Arq",
        "width": 1440,
        "height": 900,
        "resizable": true,
        "titleBarStyle": "Overlay",
        "hiddenTitle": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' https: wss:; style-src 'self'; script-src 'self' 'wasm-unsafe-eval'; object-src 'none';"
    }
  }
}
~~~

This is a starting shape, not a copy-paste security policy. Final content-security policy must match real asset, worker, collaboration, plugin, and WebAssembly loading requirements. The narrower wasm-unsafe-eval permission may be necessary for the chosen WebAssembly loading path; validate it in the packaged application. Do not ship broad unsafe-eval or unsafe-inline merely to make a prototype run. MDN documents both the CSP risk and the narrower WebAssembly permission in its [CSP reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy).

### 6.4 Deployment sequencing

1. Ship and test the browser renderer as the primary product.
2. Wrap the same app in Tauri only when desktop file, menu, packaging, or window requirements justify it.
3. Keep the canonical model and worker protocol identical across browser and Tauri.
4. Evaluate a native Metal, Direct3D, or mobile rendering backend only when profiling proves the WebView path cannot meet an approved requirement.

## 7. Platform-adaptive design system

### 7.1 Visual principles

Arq should feel quiet, direct, and spatially focused on every platform. System fonts, translucent surfaces, spring motion, and tabular figures are enhancements, not requirements. The visual system needs:

- contrast-compliant opaque fallback surfaces where blur is unavailable;
- prefers-reduced-motion support;
- visible keyboard focus and screen-reader status;
- responsive and safe-area-aware HUD placement;
- a Windows/Linux-friendly font fallback, not macOS-only typography;
- no information communicated by colour or transparency alone.

### 7.2 Contextual HUD requirements

A HUD:

- anchors near the target but collision-avoids the pointer, viewport edges, tooltips, and assistive overlays;
- exposes a short named operation and current editable quantities;
- uses a text draft separate from the canonical numeric value;
- commits on Enter or a validated blur policy, cancels with Escape, and announces validation errors;
- does not capture pointer events outside its interactive controls;
- has a non-floating equivalent in the Inspector for keyboard and touch use.

The internal unit is metres and angles use radians. Display unit and formatting are presentation preferences. [reference/quantity-draft.ts](reference/quantity-draft.ts) demonstrates a controlled length draft that will never write NaN, an empty string, or a partially typed value into canonical state.

### 7.3 Command palette requirements

The supplied palette could only close itself from an already open state. The application root must own open state and respond to Command/Ctrl+K with an explicit onOpenChange(true) action.

The palette must provide:

- a dialog role, accessible name, focus trap, focus restoration, Escape close, and inert or guarded background interaction;
- keyboard navigation using either roving tabindex or aria-activedescendant;
- an aria-live result count/status;
- deterministic command IDs, permission checks, and availability explanations;
- search that does not invoke destructive commands merely by filtering;
- touch and screen-reader equivalents for every keyboard shortcut.

### 7.4 A component contract, not a visual lock-in

The React, Tailwind, and motion-library examples in the supplied draft are valid implementation candidates. They should be introduced after the application selects exact versions and an accessibility test suite. Components must receive domain callbacks and accessibility state from the application rather than directly mutate walls or call the geometry kernel.

~~~tsx
type QuantityEditorProps = {
  readonly label: string;
  readonly draft: string;
  readonly validationMessage?: string;
  readonly onDraftChange: (text: string) => void;
  readonly onCommit: () => void;
  readonly onCancel: () => void;
};
~~~

This boundary allows an identical quantity editor to work in a HUD, Inspector, command palette, web app, and desktop shell.

## 8. Verification gates

### 8.1 GPU picking

- The first-layer pass selects the expected semantic element under a local render origin at building and georeferenced fixture scales.
- An inspect-through fixture returns the documented ordered stack and never exposes a stale draw ID after a packet rebuild.
- The readback harness verifies 256-byte row alignment and one mapped staging-buffer slot per request.
- Transparent categories follow the declared selection policy.
- A regression fixture captures small layer separation, coincident surfaces, orthographic plan view, perspective view, and device-pixel-ratio changes.

### 8.2 Deferred geometry

- A 60 Hz drag produces previews without a CSG job per pointer event.
- Pointer release produces one semantic transaction.
- A stale geometry result is dropped after a later edit or remote operation.
- A Boolean failure leaves a valid prior product, visible diagnostic, and recoverable semantic document.
- Memory and queue budgets are observed during repeated edits.

### 8.3 Desktop shell

- The browser build works without the native port.
- Tauri capabilities are denied by default and granted only to required commands.
- Production CSP has no unnecessary unsafe source.
- macOS vibrancy failure does not change core contrast or interaction.
- The packaged app is tested separately from development mode on each supported macOS release.

### 8.4 UI

- Command/Ctrl+K both opens and closes the palette, and focus returns to its invoker.
- All contextual HUD actions are discoverable by keyboard and touch.
- Numeric fields preserve incomplete drafts and reject invalid values without destructive mutation.
- Reduced-motion and high-contrast visual tests pass.

## 9. Implementation order

1. Add revision-matched draw-ID tables and a one-layer GPU ID pick behind the existing renderer adapter.
2. Build the CPU plan-index fallback and semantic selection resolver.
3. Add the cursor-scissored, capped inspect-through stack with staging-buffer ring and visual fixtures.
4. Implement the deferred CSG session protocol and stale-result rejection.
5. Build non-modal diagnostics and recovery actions before adding complex operations.
6. Create the accessible command-palette and quantity-input primitives.
7. Add a Tauri adapter only after the browser path is stable and platform requirements are documented.
8. Evaluate a true Wasm BVH or R-tree through corpus benchmarks before replacing the initial indexes.

## 10. Reference and source index

| Topic | Package reference | Primary source |
| --- | --- | --- |
| Selection IDs, readback layout, stale results | [reference/picking-contract.ts](reference/picking-contract.ts) | [WebGPU](https://www.w3.org/TR/webgpu/) |
| First/peel shader entry points | [reference/selection-id-pass.wgsl](reference/selection-id-pass.wgsl) | [WGSL](https://www.w3.org/TR/WGSL/) |
| Deferred CSG revision guard | [reference/deferred-csg-session.ts](reference/deferred-csg-session.ts) | [Master transaction lifecycle](ARQ_MASTER_TECHNICAL_SPECIFICATION.md#43-transaction-lifecycle) |
| Browser/native capability boundary | [reference/native-desktop-port.ts](reference/native-desktop-port.ts) | [Tauri v2 config](https://v2.tauri.app/reference/config/) |
| Controlled numeric quantities | [reference/quantity-draft.ts](reference/quantity-draft.ts) | [Master unit policy](ARQ_MASTER_TECHNICAL_SPECIFICATION.md#41-persistent-document) |
| Accessible command palette | Section 7.3 in this document | [WAI-ARIA modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) |
| Capability-gated rendering and workers | Sections 5 and 6 in this document | [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), [MDN OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) |

The corrected decisions for this deep dive are also recorded in [ADR-007](decision_records/ADR-007-semantic-inspect-through-selection.md), [ADR-008](decision_records/ADR-008-desktop-shell-and-native-renderer-boundary.md), and [ADR-009](decision_records/ADR-009-nonmodal-validation-and-deferred-geometry.md).

## 11. UI implementation amendments

The supplied React examples are useful visual sketches, but they need the following production corrections.

| Supplied pattern | Correction |
| --- | --- |
| HUD rotate derived from absolute X position | Derive decorative tilt from actual horizontal pointer velocity, cap it, and disable it during text entry or reduced motion |
| Position and entrance both write vertical motion | Use separate outer position and inner entrance/exit motion containers |
| Whole floating HUD accepts pointer events | Keep the panel passive; enable pointer events only for actual controls |
| Number input calls Number on every change | Keep a controlled editable draft; do not commit empty, invalid, non-finite, or incomplete values |
| Palette shortcut only closes an existing palette | The root must explicitly open the palette, restore focus on close, and respect IME composition |
| Palette rows are bare clickable containers | Use accessible dialog and navigable command controls with names, focus, and status |
| Diagnostic auto-fix mutates in place | Create a revision-guarded typed proposal and submit it through the normal transaction gateway |
| Universal glass and squircle styling | Provide a contrast-safe opaque fallback; use blur and corner shape only as progressive enhancements |

Use [ARQ_UI_UX_SYSTEM_SPECIFICATION.md](ARQ_UI_UX_SYSTEM_SPECIFICATION.md) and its references for the corrected contracts:

- [reference/hud-placement.ts](reference/hud-placement.ts)
- [reference/numeric-scrubber.ts](reference/numeric-scrubber.ts)
- [reference/command-palette-state.ts](reference/command-palette-state.ts)
- [reference/diagnostic-actions.ts](reference/diagnostic-actions.ts)
- [reference/arq-ui-theme.css](reference/arq-ui-theme.css)

The later interaction decisions are recorded in [ADR-010](decision_records/ADR-010-unified-contextual-interaction-boundary.md) and [ADR-011](decision_records/ADR-011-progressive-accessible-surface-and-motion-system.md).

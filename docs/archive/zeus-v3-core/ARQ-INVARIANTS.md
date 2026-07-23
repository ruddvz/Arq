# Arq Protected Invariants

These rules apply even when they are omitted from a visible execution contract.

## Product and scope

- Arq is a browser-first architectural plan and lightweight BIM workspace.
- Release 1 protects project → semantic plan → coordinated lightweight 3D → dimensions
  and sheet → scaled vector PDF → recoverable `.arq`.
- Do not expand a bounded task into a generic AutoCAD/Revit replacement.
- Phone capability is review/light work, not a compressed workstation.
- A visual mockup is not an implemented capability.

## Semantic model and operations

- Stable IDs coordinate tree, plan, 3D, inspector, annotations, issues and exports.
- Renderer objects and external-format classes are never canonical project data.
- Canonical and derived data are explicitly separated.
- Invalid operations leave committed state unchanged.
- Meaningful operations are reversible or explicitly non-reversible with confirmation.
- Type/instance, level, host/opening and relationship rules are explicit.
- Operation ordering, replay and hashing are deterministic.
- Undo/redo and sync apply the same validation as initial execution.

## Geometry, units and constraints

- Canonical units/numeric representation remain unresolved unless a current accepted
  ADR says otherwise.
- Coordinate space, scale, tolerance and rounding are explicit.
- Test zero length, collinearity, near parallel, overlap, self-intersection, tiny gaps,
  large coordinates, repeated edits, order independence and platform parity.
- Geometry failure returns a typed error with no partial mutation.
- Constraint solving is bounded, deterministic and diagnosable.

## Commands and interaction

- Lifecycle: idle → preview → valid/invalid → commit/cancel.
- Escape cancels; Enter commits only valid preview.
- Screen and world coordinates are structurally distinct.
- Selection/snap tie-breaks are deterministic.
- Snap results include source, priority, screen distance and suggested constraints.
- Mouse, keyboard, touch and Pencil are explicit; no hover-only function.
- Focus and accessibility state remain synchronized with model selection.

## `.arq`, storage, recovery and sync

- `.arq` is a versioned SQLite application file in the current architecture.
- Clean export requires no WAL/SHM sidecars.
- Browser editing uses a controlled local replica.
- Raw SQLite pages are never synchronized between devices.
- Sync typed operations and content-addressed resources.
- Migrations are copy-on-write, verified, resumable/recoverable and never destroy the
  only source.
- Derived caches are disposable; canonical files open without them.
- Unsupported future versions never open writable accidentally.
- Full disk, quota, power-loss, corruption and concurrent-open behaviour are tested.

## Rendering and performance

- Rendering is a projection, not the source of truth.
- Renderer selection requires comparable protected-scene evidence.
- Laboratory GPU paths do not become release claims without evidence.
- Heavy work is incremental/cancellable and does not block ordinary input.
- Degrade fidelity before correctness.
- Benchmarks report environment, workload, warm-up, samples, percentiles, memory and limitations.
- Visual and selection projection cannot become stale after model changes.

## UI/UX, accessibility and pixel precision

- Predominantly monochrome with controlled Phthalo Green `#0B6B50`.
- Canonical logo/assets only; never recreate the wordmark with live text.
- Approved tokens and 8-point spacing system.
- Touch targets at least 44 × 44 CSS pixels.
- Complete state matrix: default, hover where applicable, focus, pressed, selected,
  disabled, loading, empty, stale, offline, permission, error, partial success and
  unsupported capability.
- Canvas workflows have keyboard access, accessible object tree, announcements, focus
  restoration and non-colour state.
- Distinguish Editing locally, Saved locally, Syncing, Synced, Offline, Conflict and
  external publication.
- Pixel precision never overrides responsive layout, accessibility or content truth.

## Interoperability and export

- Exact supported subset/version is explicit.
- Preserve units, coordinates and provenance.
- Report imported, converted, omitted, unsupported and warning items.
- Untrusted parsers have resource/time/decompression/entity limits.
- DXF subset precedes broad DWG claims; IFC view/report precedes authoring claims.
- Scaled/vector export is verified independently of viewport appearance.

## AI and ArqScript

- AI proposes typed, inspectable Arq operations.
- Show request, context, assumptions, affected IDs/count, operations, validation,
  diff/preview, apply/reject, revision and undo.
- AI never directly mutates canonical state.
- Failed/partial proposals leave committed state unchanged.
- No structural safety, code compliance or professional approval claim.
- Tool/prompt output is untrusted until deterministic validation passes.

## GitHub, release and production

- No direct default-branch write by convenience.
- No merge without explicit authority, current head and required successful checks.
- No blind rerun of deterministic CI failure.
- No deployment success claim from a build-only signal.
- Deployed SHA must match intended merged SHA.
- Production Green requires applicable smoke/telemetry evidence.
- Critical regressions trigger rollback/incident protocol.

## Evidence and claims

- Do not fabricate compatibility, performance, security, certification, tests,
  reviews, pushes, merges, deployment or support.
- Headless/container evidence is not supported-device certification.
- “Pixel perfect” and “production ready” are evidence sets, not adjectives.

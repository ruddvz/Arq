# ADR-0004: Units and numeric representation

**Status:** Accepted
**Date:** 2026-09-11
**Owners:** ARQ core architecture

## Context

ARQ needs one unit and numeric-representation contract that is stable across the
TypeScript editor, the shared Rust core, `.arq` persistence, semantic hashing,
and interchange formats.

The existing editor already represents world geometry with JavaScript `number`
values. Metric and imperial input are converted into the same model-space
values, and the viewport and snapping code operate on those values. Replacing
that runtime representation would create migration risk without improving the
precision available at building scale.

Canonical persistence has a different requirement. ADR-0020 requires the same
semantic operation to produce the same semantic result and model hash on every
supported target. Raw binary floating-point values and platform-dependent
floating-point formatting are therefore a poor canonical storage and hashing
boundary even when their numerical precision is otherwise sufficient.

Interchange formats also do not justify changing the runtime model:

- IFC assigns project units globally through `IfcProject.UnitsInContext`; those
  units apply to geometric representation items. Importers can therefore
  convert source lengths into ARQ runtime millimetres and exporters can convert
  them back to the requested IFC project unit.
- DXF point and scalar geometry values are stored as double-precision values,
  while `$INSUNITS` carries drawing-unit metadata. DXF import/export can use the
  same explicit unit conversion at the boundary.

Primary references:

- buildingSMART IFC 4.3.2, Project Units:
  <https://standards.buildingsmart.org/IFC/DEV/IFC4_3/HTML/concepts/Project_Context/Project_Units/content.html>
- buildingSMART IFC 4.3.2, `IfcUnitAssignment`:
  <https://standards.buildingsmart.org/IFC/DEV/IFC4_3/HTML/lexical/IfcUnitAssignment.html>
- Autodesk AutoCAD DXF, Group Code Value Types:
  <https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-DXF/files/GUID-2553CF98-44F6-4828-82DD-FE3BC7448113.htm>
- Autodesk AutoCAD DXF, HEADER Section Group Codes (`$INSUNITS`):
  <https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-DXF/files/GUID-A85E8E67-27CD-4C59-BE61-4DC9FADBE74A.htm>

## Decision

ARQ uses a split representation for **linear geometry**.

### Runtime/editor geometry

- Canonical runtime length unit: **millimetres (mm)**.
- Runtime numeric representation: **IEEE-754 binary64 floating point**.
  - TypeScript/JavaScript uses `number`.
  - Rust uses `f64` where the shared core receives runtime geometry.
- World coordinates, lengths, viewport transforms, snaps, intersections, and
  geometric construction may contain fractional millimetres.
- The protected local-origin envelope remains at most **25 km from the local
  origin**, or a **50 km maximum span**, unless a later ADR changes that
  constraint with evidence.

### Canonical `.arq` persistence and semantic hashing

- Canonical persisted linear-geometry unit: **integer micrometres (µm)**.
- Exact conversion ratio: **1 mm = 1000 µm**.
- Persisted semantic values use signed integers. The shared Rust core should use
  `i64` for the canonical representation.
- Semantic hashes are computed from canonical integer values and their defined
  serialization. Raw runtime floating-point bit patterns or formatted decimal
  strings are not canonical hash inputs.
- Runtime millimetres are converted to canonical micrometres by multiplying by
  1000 and rounding to the nearest integer micrometre. Exact halfway cases round
  **away from zero**. This matches Rust `f64::round()` and must be implemented
  explicitly in JavaScript rather than relying on `Math.round()` for negative
  halfway values.
- Dequantisation is exact integer micrometres divided by 1000 to obtain runtime
  millimetres.
- NaN, positive or negative infinity, and coordinates outside the accepted
  project envelope are invalid at the canonical persistence boundary.

The 1 µm grid introduces at most **0.5 µm** of quantisation error per persisted
linear scalar. Import/export code must not claim arbitrary source coordinates
are lossless after canonical `.arq` persistence unless the source value is
exactly representable on that grid.

This ADR does not force angles, ratios, colours, timestamps, or other
non-linear quantities into micrometres. Their canonical representations belong
to their own contracts.

## Precision and range evidence

At the 25 km local-origin limit, a binary64 runtime coordinate is approximately
`25,000,000 mm`. Its adjacent representable spacing is about
`3.73e-9 mm`, or `3.73e-6 µm`. Runtime floating-point spacing is therefore far
smaller than the 1 µm persistence grid at the supported project scale.

JavaScript's maximum safe integer is `2^53 - 1`. If that integer is interpreted
as micrometres, it represents approximately **9,007,199 km**. This is far beyond
the protected building-scale envelope, so JavaScript can carry canonical
micrometre integers exactly for supported projects when a TypeScript boundary
must inspect them. The canonical Rust representation remains `i64`.

Imperial conversion also needs the defined tie rule. For example, `1/16 in` is
exactly `1.5875 mm`, or `1587.5 µm`, so canonical persistence must choose one of
the adjacent integer micrometre values deterministically.

## Interoperability contract

Importers and exporters own unit conversion. The model does not change its
runtime unit to match a source file.

1. Read the source format's declared or context-defined length unit.
2. Convert source linear values to runtime millimetres.
3. Perform editor and geometry operations in binary64 millimetres.
4. At canonical `.arq` persistence/hash boundaries, quantise to integer
   micrometres using the rule above.
5. On export, convert runtime millimetres to the requested target unit and emit
   the target format's required unit metadata.

A unitless or ambiguous source must be resolved by the importer workflow. It
must not silently assume a scale and write canonical geometry as if the source
unit were known.

## Alternatives considered

### Metres plus binary64 at runtime

Rejected. Binary64 metres would provide adequate numerical precision, but it
would force unnecessary migration of existing millimetre-based editor and
input code while providing no material interoperability advantage. IFC and DXF
already require explicit unit handling at their boundaries.

### Millimetres plus binary64 for both runtime and canonical persistence

Rejected as the canonical persistence contract. Numerical precision is
sufficient, but canonical semantic hashing and cross-target serialization need
a representation that does not depend on floating-point formatting details or
non-semantic bit-level differences.

### Integer micrometres everywhere, including geometry runtime

Rejected for the runtime/editor layer. Rotations, intersections, transforms,
curve evaluation, and other geometry operations naturally produce fractional
results. Fixed-point runtime arithmetic would not eliminate the need for robust
predicates, tolerances, overflow handling, or carefully specified rounding. It
would impose those costs throughout the editor rather than at the persistence
boundary where determinism is required.

### Finer canonical grids

Nanometres or smaller units are rejected for now. They consume integer range
without an evidenced building-product requirement. One micrometre is already
far finer than the product's building-scale precision needs and is safely
inside the supported coordinate envelope.

## Consequences

### Benefits

- Existing runtime geometry and editor code keeps its established millimetre
  convention.
- Canonical storage and semantic hashes have a deterministic integer boundary.
- IFC, DXF, metric, and imperial inputs are handled as explicit boundary
  conversions rather than changing model units.
- The 1 µm grid is substantially finer than required display/input precision at
  the supported project scale.

### Costs

- Persistence and hashing code needs one shared, tested mm-to-µm
  canonicalisation helper and the inverse conversion.
- Values not exactly representable at 1 µm are quantised, with a maximum
  0.5 µm error per scalar.
- Boundary code must reject non-finite and out-of-envelope values instead of
  allowing them into canonical state.
- JavaScript and Rust must share the same halfway rounding rule.

### Migration rule

Existing in-memory/editor values remain unchanged. This ADR becomes normative
for geometry fields as they are moved into canonical SQLite `.arq` tables and
semantic hashing. A persistence migration must convert older floating-point
geometry through the same canonicalisation helper. It must never reinterpret
an old floating-point value as if it were already an integer micrometre value.

Changing the canonical grid later requires a versioned `.arq` schema migration
and a semantic-hash version change. It is not a silent implementation detail.

## Validation

Before synced persisted geometry tables depend on this decision:

- the shared Rust core must expose deterministic mm-to-µm and µm-to-mm helpers;
- tests must cover positive and negative halfway values, sub-micrometre values,
  the 25 km envelope, rejection of non-finite values, and overflow handling;
- TypeScript/WASM/native parity tests must prove identical canonical integers;
- semantic-hash tests must hash canonical integers rather than raw floats; and
- IFC/DXF import tests must verify declared source units are converted at the
  boundary and ambiguous unitless input is not silently guessed.

Those implementation tests belong to the issues that introduce the persistence,
hash, and interchange paths. This issue resolves the representation contract
rather than speculatively implementing those later features.

## Related

- D-014 in `docs/product/DECISION-REGISTER.csv`
- ADR-0019: native `.arq` file format
- ADR-0020: shared Rust core
- `docs/architecture/SHARED-RUST-CORE.md`
- ARQ-058 / issue #88

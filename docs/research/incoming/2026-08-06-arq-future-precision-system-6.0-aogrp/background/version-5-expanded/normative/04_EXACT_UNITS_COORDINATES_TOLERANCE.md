# Exact units, coordinates, and tolerance

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Precision work requires canonical quantities that remain stable across languages and platforms. Geometric algorithms may use floating point internally, but accepted dimensions and identity-bearing values use exact representations.

## Normative requirements

- A canonical quantity MUST include integer coefficient, decimal scale, unit identifier, and optional uncertainty or tolerance reference.
- Coefficient and scale ranges MUST be bounded and validated before arithmetic.
- Unit identifiers MUST come from a versioned registry with dimensional analysis.
- Coordinate frames MUST have stable identity, handedness, axis convention, origin, parent frame, and transformation semantics.
- Large projects MUST support local engineering frames and geospatial frames without feeding planet-scale coordinates directly into low-precision rendering.
- Tolerance MUST be explicit by operation, domain, material, process, or analysis profile. A single global modelling tolerance is insufficient.
- Conversion to floating-point kernel values MUST record rounding mode, range checks, and achieved error bounds.

## Required invariants

- Overflow and underflow.
- Unitless numeric blobs.
- Mixed millimetre and metre values.
- Geospatial precision loss.
- Tolerance larger than the feature.
- Kernel result outside requested error bound.

## Known failure modes

- Equal canonical quantities encode identically after normalisation.
- Incompatible dimensions cannot be compared or combined without an explicit conversion operation.
- Tolerance never changes silently when units or coordinate frames change.

## Required evidence

- Property-based arithmetic tests.
- Cross-language golden vectors.
- Extreme range and conversion fixtures.
- Coordinate-frame roundtrip tests.
- Kernel adapter error-budget reports.

## Implementation guidance

- Start with exact decimal scaled integers for dimensions and parameters.
- Use rational representations only where the repository demonstrates a need.
- Keep rendering origin rebasing derived and reversible.

## Open decisions

- Maximum coefficient bits.
- Accepted scale range.
- Authoritative unit registry and geospatial library.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

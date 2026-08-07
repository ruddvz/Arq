# Interchange fidelity and roundtrip evidence

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Interchange is an evidence-producing transformation, not a boolean success. Each adapter must classify what was preserved, mapped, approximated, flattened, omitted, unsupported, or retained as source-only.

## Normative requirements

- Every import and export MUST name source and target format, exact edition, profile, adapter version, settings, units, coordinate frame, and source hash.
- Each source object or logical group MUST receive a fidelity classification: native editable, mapped editable, exact reference, approximate reference, flattened, omitted, unsupported, or preserved source only.
- Geometry validation SHOULD record counts, bounds, area, volume, mass properties where meaningful, topology, and tolerances.
- Semantic validation MUST report type, property, relationship, classification, constraint, assembly, annotation, and presentation mappings separately.
- Roundtrip claims MUST be based on a defined source-target-source or target-source-target corpus and acceptance thresholds.
- Source capsules MUST not be represented as editable native ARQ data unless mapped semantics exist.

## Required invariants

- Wrong units.
- Coordinate shifts.
- Unsupported curves or surfaces.
- Flattened feature history.
- Lost properties.
- Broken external references.
- Duplicated identities.
- Colour and layer mismatch.

## Known failure modes

- Parser completion is not fidelity.
- Visual similarity is not geometric equivalence.
- One successful file does not establish format support.
- Approximation is visible and queryable.

## Required evidence

- Format-edition corpus.
- Object-level mapping reports.
- Independent target-tool open tests.
- Roundtrip metrics.
- Negative unsupported-feature fixtures.

## Implementation guidance

- Create named exchange profiles rather than one universal exporter.
- Make the fidelity report available before the user overwrites or sends the result.
- Preserve original bytes where policy and licensing allow.

## Open decisions

- First supported formats and profiles.
- Licensing for proprietary adapter SDKs.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

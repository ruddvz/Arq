# Geometry representations and kernel adapter

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

ARQ supports multiple geometry representations without allowing any derived representation to erase semantic intent. Exact B-Rep, parametric sketches, meshes, subdivisions, SDFs, point clouds, terrain, and procedural graphs have different roles.

## Normative requirements

- Every geometry recipe MUST identify source semantic objects, parameters, coordinate frame, tolerance policy, adapter operation, and expected result class.
- Kernel requests and responses MUST be versioned, bounded, cancellable where possible, and return structured diagnostics and topology history.
- Exact geometry payloads MUST identify kernel family, kernel version, codec, tolerance, source revision, and validation state.
- Meshes MUST identify source geometry digest, mesher version, chordal and angular tolerances, normals policy, and LOD.
- Failed regeneration MUST preserve previous accepted canonical state and mark derived outputs stale or unavailable.
- Approximate representations MUST never be relabelled exact because they visually match at one zoom level.

## Required invariants

- Kernel crash.
- Boolean returns open shell.
- Fillet topology changes.
- Mesh self-intersection.
- Stale mesh shown as current.
- Version upgrade changes shape.
- Unsupported surface type.

## Known failure modes

- Semantic recipe remains readable without optional kernel payload.
- Every derived geometry result is traceable to source revision and generator.
- Invalid geometry cannot be promoted as current verified geometry.

## Required evidence

- Golden shape fixtures with mass, volume, area, topology, bounds, and validity checks.
- Native and WASM comparison.
- Kernel upgrade differential tests.
- Cancellation and timeout tests.

## Implementation guidance

- Adopt a kernel-neutral adapter before selecting production kernel payload schemas.
- Use B-Rep for precision solids, mesh for delivery, subdivision for styling, and procedural systems for large repetition.
- Do not force all domains into one geometry type.

## Open decisions

- Initial production kernel.
- Whether exact payloads are portable guarantees or optional acceleration caches.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

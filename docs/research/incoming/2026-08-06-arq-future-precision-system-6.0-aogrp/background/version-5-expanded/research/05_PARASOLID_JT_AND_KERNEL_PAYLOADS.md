# Parasolid, JT, and kernel-payload research

**Status:** Research and proposal input. External sources do not establish current ARQ implementation truth.

## Scope

Parasolid and JT are evaluated as examples of precise kernel representation and lightweight product visualisation. Proprietary licence and implementation details remain outside this package.

## Verified source observations

- Kernel-native payloads can preserve exact geometry with high fidelity inside a compatible kernel ecosystem.
- Kernel payload compatibility is tied to kernel versions, licences, platform support, and vendor contracts.
- JT demonstrates the value of combining product structure, multiple levels of detail, tessellation, and optional precise geometry for large assemblies.
- Opaque payloads are useful caches or exchange capsules but are dangerous as the only source of semantic truth.

## Lessons for `.arq`

- ARQ may store optional kernel payloads with explicit kernel family, version, codec, tolerance, source revision, and regeneration recipe.
- A missing or unsupported kernel payload must not make the semantic project unreadable.
- Derived LOD and tessellation records should be content-addressed and invalidated by dependency hashes.

## Gaps ARQ can address

- ARQ can remain kernel-neutral at the semantic layer while still supporting high-fidelity kernel caches.
- ARQ can prevent version upgrades from silently rewriting the only exact geometry representation.
- ARQ can require a geometry audit when changing kernel family or major version.

## Primary sources consulted

- Siemens Parasolid and JT documentation requires licensed implementation review.

## Limits

- No proprietary SDK was available.
- Licensing, export control, and redistribution constraints require legal review.
- No binary compatibility claim is made.

# glTF, CityGML, and 3D Tiles research

**Status:** Research and proposal input. External sources do not establish current ARQ implementation truth.

## Scope

These standards are evaluated as complementary delivery, city semantics, and large-spatial-streaming layers rather than canonical precision-authoring formats.

## Verified source observations

- glTF is optimised for efficient transmission and runtime rendering of 3D scenes and models.
- CityGML represents semantic city objects and supports multiple levels of detail and thematic modules.
- 3D Tiles provides hierarchical spatial subdivision, bounding volumes, refinement, and streaming for massive geospatial datasets.
- Each format solves a different problem. Combining them into one undifferentiated canonical model would lose important distinctions.

## Lessons for `.arq`

- ARQ should export glTF as derived visual delivery with source revision and approximation evidence.
- Urban domain packs should map to CityGML profiles where appropriate but keep ARQ design intent and operations separately.
- City-scale viewers should use 3D Tiles-style hierarchy and LOD metadata while resolving editable source projects on demand.

## Gaps ARQ can address

- ARQ can link every delivered tile or visual asset to exact semantic source revisions.
- ARQ can distinguish design LOD, geometric LOD, simulation resolution, and streaming LOD.
- ARQ can support edit-in-context without pretending every streamed tile is natively editable.

## Primary sources consulted

- Khronos glTF specification, EXT-GLTF.
- OGC CityGML standard, EXT-CITYGML.
- OGC 3D Tiles standard, EXT-3DTILES.

## Limits

- No renderer benchmark was executed.
- Geospatial datum and coordinate-operation policy still requires domain experts and test datasets.

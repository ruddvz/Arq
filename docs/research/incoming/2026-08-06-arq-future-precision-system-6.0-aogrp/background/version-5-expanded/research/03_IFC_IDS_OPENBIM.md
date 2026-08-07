# IFC, MVD, and IDS research

**Status:** Research and proposal input. External sources do not establish current ARQ implementation truth.

## Scope

IFC is evaluated as an open semantic exchange family for buildings and infrastructure. Model View Definitions and Information Delivery Specifications are treated as essential profile and requirement layers.

## Verified source observations

- IFC 4.3 extends the schema into infrastructure domains and provides broad semantic and geometric structures.
- An IFC edition alone does not define a complete exchange contract. The chosen MVD or implementation agreement determines the practical subset and expected behaviour.
- IDS provides machine-checkable information requirements, helping separate what information is required from the full technical schema footprint.
- Geometry, classifications, property sets, relationships, spatial structures, units, coordinate systems, and owner history all require edition-aware mapping.

## Lessons for `.arq`

- Every ARQ IFC import or export profile must name the IFC edition, MVD, IDS requirements, geometry strategy, and unsupported concepts.
- ARQ should preserve original IFC entity identity and source references where lawful and useful, while assigning separate native ARQ identity.
- Validation reports should distinguish schema validity, profile conformance, information requirement satisfaction, geometric validity, and semantic mapping fidelity.

## Gaps ARQ can address

- ARQ can make profile selection and IDS compliance visible before export rather than after external rejection.
- ARQ can preserve operation provenance and design intent that exchange IFC does not necessarily carry.
- ARQ can support federated references and partial loading while retaining exact source revision evidence.

## Primary sources consulted

- buildingSMART IFC schema specifications, EXT-IFC.
- buildingSMART MVD guidance, EXT-MVD.
- buildingSMART IDS standard, EXT-IDS.

## Limits

- No full IFC certification suite was executed.
- OpenBIM does not imply lossless roundtrip through every authoring platform.
- Product-specific export behaviour remains unverified.

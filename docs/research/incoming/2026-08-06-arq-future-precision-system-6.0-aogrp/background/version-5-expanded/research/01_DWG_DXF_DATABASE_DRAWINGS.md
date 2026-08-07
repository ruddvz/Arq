# DWG and DXF drawing database research

**Status:** Research and proposal input. External sources do not establish current ARQ implementation truth.

## Scope

DWG and DXF are evaluated for object identity, drawing structures, handles, ownership, references, compatibility, and long-lived ecosystem behaviour. This research does not claim unrestricted access to proprietary internals.

## Verified source observations

- DWG behaves as a structured drawing database rather than a flat list of lines. Persistent object handles, ownership, references, symbol tables, dictionaries, blocks, layouts, and extension data are central compatibility concepts.
- DXF exposes a text or binary exchange representation with group-code structures. It is easier to inspect but can lose application-specific behaviour and may vary by edition and exporter.
- Drawing formats preserve presentation constructs that product and BIM formats often treat as secondary, including layers, blocks, linetypes, annotation, layouts, viewports, and paper-space concerns.
- Long compatibility depends on edition-aware readers, unknown-object preservation, proxy objects, repair tooling, and extensive corpus testing rather than one parser.

## Lessons for `.arq`

- Give every semantic object a stable project-scoped identity that is independent from SQLite row IDs and geometry indexes.
- Treat sheets, viewports, styles, annotations, blocks, and references as typed semantic structures, not render-only decoration.
- Preserve unsupported source objects in a quarantined source capsule when licensing permits, with explicit edit and roundtrip limits.
- Record exact source edition, importer version, mapping profile, warnings, omissions, and source hash.

## Gaps ARQ can address

- ARQ can make interchange fidelity visible at object and property level instead of returning a single success flag.
- ARQ can separate source-preservation from native editability, avoiding false claims that imported proxy data is fully understood.
- ARQ can couple drawing state to the same semantic revision as 3D and analysis, reducing silent drawing-model divergence.

## Primary sources consulted

- Open Design Alliance DWG specification, EXT-ODA-DWG.
- Autodesk DXF reference should be consulted at implementation time for exact target editions.

## Limits

- Public documentation cannot establish every proprietary DWG behaviour.
- No licensed roundtrip corpus was available in this package.
- ARQ should not market DWG losslessness without edition-specific evidence.

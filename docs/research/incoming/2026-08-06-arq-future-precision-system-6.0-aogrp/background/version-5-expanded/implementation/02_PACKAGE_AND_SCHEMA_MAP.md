# Package and schema map

## Core registries

- Type registry: semantic component and relationship schemas.
- Operation registry: versioned commands and preconditions.
- Capability registry: required and optional feature namespaces.
- Unit registry: dimensional units and conversions.
- Diagnostic registry: stable errors and recovery actions.
- Interchange profile registry: exact editions, mappings, and validation.
- Codec registry: canonical payload, kernel payload, mesh, and asset codecs.

## Candidate database groups

- `arq_meta`, `arq_project`, `arq_publication` for identity and format preflight.
- `arq_capability` and `arq_extension` for compatibility.
- `arq_object`, `arq_component`, `arq_relation` for semantic state.
- `arq_operation_group`, `arq_operation`, `arq_revision` for accepted history.
- `arq_branch`, `arq_conflict`, `arq_selection` for versioning and persistent references.
- `arq_asset`, `arq_external_reference` for content and federation.
- `arq_derived_artifact`, `arq_geometry_payload` for disposable outputs.
- `arq_evidence`, `arq_diagnostic`, `arq_migration` for trust and recovery.

## Schema policy

Each payload table stores schema ID and schema version. Schemas are registered and tested outside the database. Unknown required schemas block writing. Optional opaque payloads can be preserved only when their hash, namespace, byte representation, and ownership remain intact.

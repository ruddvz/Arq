# Open questions and blockers

## Blocked by repository access

- Current `.arq` application ID, header checks, schema layout, migrations, and codecs.
- Current semantic model and typed operation definitions.
- Current browser SQLite library, OPFS strategy, journalling, and save path.
- Accepted ADRs and the ADR-0027 collision noted by the Project snapshot.
- Actual MCP library surface and whether any client has completed a run.
- Existing tests, golden fixtures, fuzzing, and CI gates.

## Architecture questions requiring accepted decisions

- Is deterministic CBOR the canonical operation encoding or only the interchange encoding?
- Are exact quantities represented as signed coefficient plus decimal scale, rational values, or fixed domain units?
- Is revision identity a Merkle root over semantic components, an ordered operation log, or both?
- Which geometry kernel is authoritative for regeneration, and how are version changes handled?
- Which unknown extension data may be preserved without interpretation?
- What collaboration model is expected before server-side sync exists?
- What is the supported maximum project size for browser-only operation?
- Which professional domains are in scope for first five years?

## Research blockers

Proprietary internals and licensing for DWG, RVT, Parasolid, CATIA, SolidWorks, and JT cannot be fully verified from public documentation. Any interoperability commitment requires licensed SDK evaluation and roundtrip fixtures.

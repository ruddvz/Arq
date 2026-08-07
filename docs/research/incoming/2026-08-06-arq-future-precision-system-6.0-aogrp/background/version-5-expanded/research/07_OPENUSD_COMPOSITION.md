# OpenUSD composition research

**Status:** Research and proposal input. External sources do not establish current ARQ implementation truth.

## Scope

OpenUSD is evaluated for layer composition, references, payloads, variants, overrides, namespaces, selective loading, and large-scene collaboration patterns.

## Verified source observations

- OpenUSD composes scene descriptions from layers and arcs rather than forcing all data into one monolithic file.
- References and payloads support reuse and selective loading. Variants support alternate configurations. Stronger layers can override weaker opinions.
- USD is designed for scene description and interchange in content pipelines. It is not by itself a canonical precision CAD feature-history system.
- Composition power introduces complexity around namespace edits, layer strength, dependency resolution, and missing assets.

## Lessons for `.arq`

- ARQ federation should borrow pinned references, payload-style loading, variants, and non-destructive overrides while retaining typed precision semantics.
- Every composed child must record project ID, immutable revision, transform, coordinate frame, expected hash, capability requirements, and fallback policy.
- ARQ should not expose unrestricted composition opinions that bypass semantic invariants.

## Gaps ARQ can address

- ARQ can combine scene-scale composition with exact design operations and evidence.
- ARQ can make stale or missing child revisions explicit before publication.
- ARQ can separate presentation variants from engineering configurations.

## Primary sources consulted

- Alliance for OpenUSD documentation, EXT-USD.

## Limits

- No USD conformance or resolver plugin was implemented.
- USD binary and crate formats should not be copied without full specification and licence review.

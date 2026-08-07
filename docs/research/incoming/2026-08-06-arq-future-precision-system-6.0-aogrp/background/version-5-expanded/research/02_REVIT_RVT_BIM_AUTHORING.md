# Revit and RVT BIM authoring research

**Status:** Research and proposal input. External sources do not establish current ARQ implementation truth.

## Scope

Revit is evaluated as a semantic BIM authoring system with transactions, element identities, families, parameters, links, central-local collaboration, regeneration, and view-dependent presentation. RVT internals remain proprietary.

## Verified source observations

- Revit distinguishes model elements, types, instances, parameters, views, sheets, families, and linked documents within a transactional application model.
- Element identity is application-managed, but copied, linked, grouped, upgraded, or regenerated content can challenge external references and interoperability.
- Central-local worksharing demonstrates the need for ownership, synchronisation, conflict management, and user-visible stale-state handling, but it also creates operational complexity.
- RVT upgrade is application-mediated. A file opening successfully in a newer version is not evidence that an older writer can safely continue editing it.

## Lessons for `.arq`

- ARQ should separate object identity, type identity, instance identity, reference identity, and geometric selection identity.
- Every view and sheet should declare which revision and configuration it derives from.
- Linked projects should be pinned by project ID, revision, transform, coordinate frame, and expected content hash.
- Migration must be copy-on-write and produce a machine-readable report before promotion.

## Gaps ARQ can address

- ARQ can avoid opaque central-file authority by making revisions and operation groups explicit and portable.
- ARQ can make derived-view staleness and regeneration failures first-class instead of hiding them behind visual updates.
- ARQ can support unknown extension preservation without pretending it is natively editable.

## Primary sources consulted

- Autodesk Revit API and help documentation should be used for implementation-specific element and transaction behaviour.
- Project source ARQ-OS3-PROTECTED-WORKFLOW for ARQ workflow authority.

## Limits

- RVT file structure is proprietary.
- No Revit SDK or production files were inspected.
- Comparisons concern workflow patterns, not binary equivalence.

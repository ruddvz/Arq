# STEP AP242 product-data research

**Status:** Research and proposal input. External sources do not establish current ARQ implementation truth.

## Scope

STEP AP242 is evaluated for exact product geometry exchange, product structure, assemblies, product manufacturing information, tessellation, validation properties, and long-term neutral exchange.

## Verified source observations

- AP242 addresses managed model-based 3D engineering data and combines geometric, assembly, product structure, and annotation concerns.
- Neutral exact geometry exchange is different from preserving a source application feature tree. A STEP solid can be geometrically useful while losing native parametric design history.
- Validation properties and persistent identifiers can improve exchange checking but do not guarantee source application roundtrip.
- Edition, conformance class, implementation method, and application protocol scope must be explicit.

## Lessons for `.arq`

- ARQ should classify imported STEP content separately as exact reference geometry, mapped editable semantics, reconstructed features, or preserved source.
- Original product structure and identifiers should be retained alongside native ARQ object identities.
- Exports should include validation properties and compare mass, area, volume, bounding boxes, assembly counts, and geometry checks where applicable.

## Gaps ARQ can address

- ARQ can retain the accepted operation and feature history even when exporting a neutral geometric representation.
- ARQ can report exactly which feature semantics were flattened during export.
- ARQ can attach solver and manufacturing evidence without confusing those records with standard conformance.

## Primary sources consulted

- ISO STEP AP242 official standard and implementer documentation must be licensed or accessed for implementation.
- CAx-IF recommended practices should be included in a production evaluation.

## Limits

- The complete ISO text was not included in this package.
- No commercial STEP translator was benchmarked.
- No claim of AP242 conformance is made.

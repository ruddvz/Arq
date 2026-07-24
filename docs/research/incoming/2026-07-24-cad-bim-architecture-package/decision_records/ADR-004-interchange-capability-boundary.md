# ADR-004: Interchange support is capability-scoped

**Status:** accepted  
**Date:** 24 July 2026

## Context

IFC, DXF, DWG, and STEP have different semantic, legal, and technical implications. A broad compatibility claim would be misleading and difficult to test.

## Decision

Arq publishes supported entity/property/geometry subsets backed by fixtures:

- IFC is semantic exchange with explicit mapping and reports.
- DXF is scoped 2D interchange.
- STEP is geometry-first interchange.
- DWG is deferred until a separately approved licensed strategy exists.

## Consequences

- Importer work has testable boundaries.
- Unsupported content yields diagnostics instead of invented conversions.
- Product messaging remains accurate.

## Rejected alternatives

- "Import/export IFC 4.3 and DXF/DWG" as one milestone
- Silent approximation of unsupported source entities

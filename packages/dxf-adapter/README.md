# @arq/dxf-adapter

DXF reading - an import-side prototype parser; DXF export is not built yet.

`parseDxf` (ARQ-158) is a prototype reader for DXF's ASCII form, covering
`docs/interoperability/DXF-PLAN.md`'s Stage 1 entity list: LINE, LWPOLYLINE,
ARC, CIRCLE, TEXT, plus layers (per entity) and units (`$INSUNITS`). Every
other entity type is reported by name and count in the result's
`supportReport.unsupportedEntityCounts`, never silently dropped. `parseDxf`
never throws - it always returns a well-formed `DxfParseResult`
(`'parsed'` or `'rejected'`).

Deliberately a hand-written parser, not a third-party DXF library: no DXF
parsing dependency has been reviewed or approved yet (ADR-0012 is still
Proposed), and this issue's own non-goal rules out introducing an
unreviewed one. DXF's ASCII group-code format is simple enough (flat
alternating code/value line pairs) that Stage 1's five entity types don't
need one.

Export, DWG, and mapping parsed entities into real `@arq/bim-core`
elements are all out of this prototype's scope - see ADR-0012 and
`docs/commands/specs/CMD-091-import-dxf.md` / `CMD-092-export-dxf.md` for
the full command-level scope this prototype is one step toward.

See `docs/interoperability/DXF-SUPPORT-MATRIX.md` (ARQ-159) for the
complete, test-backed matrix of exactly what is and is not read today.

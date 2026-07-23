# DXF plan

Stage 1 entities:

- LINE
- LWPOLYLINE
- ARC
- CIRCLE
- TEXT
- layers
- units
- simple blocks as groups where practical

Candidates:

- dxfjs/parser
- dxf-parser-writer
- ezdxf server-side

Report unsupported entities. DXF support does not imply DWG support.

See `docs/interoperability/DXF-SUPPORT-MATRIX.md` (ARQ-159) for exactly
what `@arq/dxf-adapter`'s prototype parser (ARQ-158) reads today, against
this Stage 1 list.

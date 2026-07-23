# DXF support matrix (ARQ-159)

What `@arq/dxf-adapter`'s `parseDxf` (`packages/dxf-adapter/src/dxf-parser.ts`,
ARQ-158) actually reads today - not an aspirational target. Every row below
is backed by a passing test in that package (26/26 passing at the time of
writing); nothing here is claimed without test evidence. See
`docs/interoperability/DXF-PLAN.md` for the original Stage 1 scope this
matrix reports against, and `docs/adr/0012-dxf-and-dwg-strategy.md` for the
still-open decision this prototype is one spike toward.

## File format

| Item       | Status        | Notes                                                                                |
| ---------- | ------------- | ------------------------------------------------------------------------------------ |
| DXF ASCII  | Supported     | The only form read - `dxf-tokenizer.ts` parses alternating (code, value) text lines. |
| DXF Binary | Not supported | No binary-DXF reader exists; binary content is not recognized as DXF at all.         |
| DWG        | Not supported | Out of scope per ADR-0012 ("do not promise DWG early"); no code exists for it.       |

## Sections read

| Section    | Status         | Notes                                                                                                                                               |
| ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HEADER`   | Partially read | Only the `$INSUNITS` variable is read; every other header variable is walked over and ignored.                                                      |
| `ENTITIES` | Read           | The only section this prototype extracts drawing content from.                                                                                      |
| `TABLES`   | Not read       | Layer _definitions_ (colour, linetype, frozen state, ...) are not read - see "Layers" below for what layer information this prototype does capture. |
| `BLOCKS`   | Not read       | Block definitions are not read; an `INSERT` entity referencing a block is reported as unsupported (see below).                                      |
| `OBJECTS`  | Not read       | Not read.                                                                                                                                           |
| `CLASSES`  | Not read       | Not read.                                                                                                                                           |

## Entities

| Entity                                                  | Status        | Notes                                                                                                                                                     |
| ------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LINE`                                                  | Supported     | Start/end point (group 10/20/11/21); z (30/31) discarded - 2D only.                                                                                       |
| `CIRCLE`                                                | Supported     | Center + radius (10/20/40).                                                                                                                               |
| `ARC`                                                   | Supported     | Center + radius + start/end angle in degrees (10/20/40/50/51).                                                                                            |
| `LWPOLYLINE`                                            | Supported     | Ordered vertex list (10/20 pairs) + closed flag (group 70, bit 0). Bulge (group 42, arc segments) is **not** read - every segment is treated as straight. |
| `TEXT`                                                  | Supported     | Insertion point, height, string (10/20/40/1). Rotation, style, and alignment groups are **not** read.                                                     |
| `POLYLINE` (old-style, with separate `VERTEX` entities) | Not supported | Only the newer `LWPOLYLINE` form is read.                                                                                                                 |
| `MTEXT`                                                 | Not supported | Multiline text is not read; only single-line `TEXT` is.                                                                                                   |
| `INSERT`                                                | Not supported | Block references are not resolved.                                                                                                                        |
| `DIMENSION`                                             | Not supported | Not read.                                                                                                                                                 |
| `HATCH`                                                 | Not supported | Not read.                                                                                                                                                 |
| `SPLINE`                                                | Not supported | Not read.                                                                                                                                                 |
| `3DFACE`, `SOLID`, other 3D/solid entities              | Not supported | This prototype is 2D linework exchange only, per DXF-PLAN.md.                                                                                             |
| Any other entity type not listed above                  | Not supported | Reported by name and count in the parse result's `supportReport.unsupportedEntityCounts` (`dxf-parser.ts`) - never silently dropped without a trace.      |

A recognized entity type missing a required field (a truncated or
hand-edited file) is treated identically to an unrecognized type: it is not
preserved, and is counted under its own type name in
`supportReport.unsupportedEntityCounts` - see `dxf-entity-parser.ts`'s doc
comment for why both cases share one bucket rather than a third category.

## Layers

| Item                                                        | Status        | Notes                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-entity layer assignment (group 8)                       | Supported     | Read for every entity; defaults to DXF's own `"0"` default layer when absent.                                                                                                                                          |
| Full layer table (colour, linetype, on/off, frozen, locked) | Not supported | `TABLES` is not read; the result's `layers` list is only the set of layers actually used by _preserved_ entities, not the drawing's complete declared layer set (including layers with no supported entities on them). |

## Units

| `$INSUNITS` code                      | Unit        | Status                                                             |
| ------------------------------------- | ----------- | ------------------------------------------------------------------ |
| 0                                     | Unitless    | Supported                                                          |
| 1                                     | Inches      | Supported                                                          |
| 2                                     | Feet        | Supported                                                          |
| 4                                     | Millimeters | Supported                                                          |
| 5                                     | Centimeters | Supported                                                          |
| 6                                     | Meters      | Supported                                                          |
| Any other code, or `$INSUNITS` absent | -           | Resolves to `'unspecified'` (`dxf-units.ts`) rather than guessing. |

## Failure behaviour

`parseDxf` never throws for any input (garbage, empty, or truncated
content), always returning a well-formed `'parsed'` or `'rejected'` result.
It is a pure function that reads bytes into a plain result value and
mutates no existing project state, so a failure - by construction - cannot
partially mutate a project.

## Out of scope for this matrix

DXF export (`CMD-092-export-dxf.md`), mapping preserved entities into real
`@arq/bim-core` elements (walls, rooms, ...), and any DWG support are all
separate, later work - this matrix describes only what `parseDxf` reads
today.

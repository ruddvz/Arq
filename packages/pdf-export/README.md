# @arq/pdf-export

Vector-accurate PDF sheet export - not a screenshot pipeline.

`exportSheetToPdf` (ARQ-142) is a pdf-lib-based prototype: given a Sheet
(`@arq/bim-core`) and its already-projected `SheetViewportScene`
(`@arq/plan-renderer`, ARQ-141), it produces real PDF vector content -
lines, polygons and text drawn as PDF operators, not a rasterised
screenshot. See blueprint section 59 ("PDF export") for the full
ten-step export pipeline this prototype covers steps 4 and 6 of; the
module's own doc comment lists which of section 59's "Limitations to
design around" remain open (font embedding, per-element line weight,
text wrapping, memory bounds on huge drawings).

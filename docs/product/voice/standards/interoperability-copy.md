# Interoperability language standard

## “Support” is a matrix, not a binary adjective

For every external format distinguish:

- detection;
- underlay/reference;
- parsing;
- viewing;
- property inspection;
- linework import;
- semantic conversion;
- export;
- round-trip expectations;
- current product reachability;
- planned release.

A parser existing in a package is not equivalent to product support.

## Fidelity vocabulary

Use only when the underlying adapter/report can justify the category:

- **Preserved**: meaning and value retained.
- **Converted**: mapped into a different Arq representation.
- **Approximated**: representation changed with measurable or known loss.
- **Flattened**: semantic or structured data reduced to a simpler representation.
- **Omitted**: intentionally not included.
- **Unsupported**: no supported mapping.
- **Opaque**: retained without Arq interpreting the content.
- **Failed**: processing did not complete for the item.

Do not use **lossless** as a marketing shortcut.

## Import result

A useful import result answers:

- source format;
- detected units/scale where applicable;
- imported/preserved count or scope;
- converted/approximated content;
- omitted/unsupported content;
- warnings;
- source file status;
- destination/project state.

## Export result

A useful export result answers:

- output format;
- exported scope;
- included content;
- omitted/unsupported content;
- warnings;
- output location/file;
- validation state.

## Roadmap wording

Use the current format support matrix.

Examples:

- `.arq`: native project format.
- PNG/JPEG: underlay role in Release 1 scope.
- PDF: underlay and vector export in Release 1 scope.
- DXF: linework exchange in Release 2 scope.
- IFC: viewing and property inspection in Release 2 scope.
- DWG: not committed.
- RVT: not committed.

Do not turn “planned release role” into a present-tense capability.

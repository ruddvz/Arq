# Format support matrix

| Format   | First role                            | Early status  |
| -------- | ------------------------------------- | ------------- |
| `.arq`   | Native archive                        | Release 1     |
| PNG/JPEG | Underlay                              | Release 1     |
| PDF      | Underlay and vector export            | Release 1     |
| DXF      | Linework exchange                     | Release 2     |
| IFC      | Viewing and inspection                | Release 2     |
| glTF/GLB | Visual exchange                       | Later         |
| BCF      | Issue exchange                        | Later         |
| STEP     | Selected solids                       | Later         |
| DWG      | Licensed conversion only if justified | Not committed |
| RVT      | Connector or external workflow only   | Not committed |

DXF's own detailed entity/section/units matrix, reflecting what the
`@arq/dxf-adapter` prototype parser actually reads (not just this release
target): `docs/interoperability/DXF-SUPPORT-MATRIX.md` (ARQ-159).

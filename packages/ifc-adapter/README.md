# @arq/ifc-adapter

IFC import/export via web-ifc, plus the canonical IFC <-> Arq entity mapping. MPL-2.0 - keep isolated per §19.

`readIfcModel` (ARQ-160) is a prototype "viewer" - reading, per
`docs/interoperability/FORMAT-SUPPORT-MATRIX.md`'s stated IFC role
("Viewing and inspection"), not authoring or export. It reads spatial
structure (`IFCPROJECT`/`IFCSITE`/`IFCBUILDING`/`IFCBUILDINGSTOREY`/
`IFCSPACE`) plus common building elements (`IFCWALL`/`IFCDOOR`/`IFCWINDOW`/
`IFCSLAB`/`IFCCOLUMN`/`IFCBEAM`/`IFCROOF` - see `ifc-supported-types.ts`)
into a plain summary (express ID, IFC type, name, global ID). No geometry
is extracted, and no mapping into real `@arq/bim-core` elements happens
here - both are separate, later steps.

`web-ifc` is the only dependency this package (or any other in this
monorepo) takes on it - `open-source/TECHNOLOGY-MATRIX.csv`/`.json`
already recorded it with treatment "isolate and spike" before this issue;
ARQ-160 is exactly that spike. `readIfcModel` never throws - it always
returns a well-formed `'read'` or `'rejected'` result, and touches no
existing project state, so failure cannot partially mutate a project.

**Known limitation, measured directly against the real library**: on
malformed or invalid IFC content, `web-ifc`'s own `OpenModel` can take
anywhere from about 1 to over 30 real seconds before throwing (varying by
exactly how the content is malformed), even though a well-formed file of
the same size opens in milliseconds. This is `web-ifc`'s own internal
error-handling behaviour, not a bug in this module, but it means untrusted
IFC content must never reach `readIfcModel` without an outer size/timeout
gate in front of it - the same category of protection ARQ-157 already
gives `@arq/project-format`'s archive import. Adding that gate is out of
this prototype's scope; it is recorded here so the risk is not silently
lost.

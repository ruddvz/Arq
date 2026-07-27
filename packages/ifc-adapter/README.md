# @arq/ifc-adapter

IFC reading via web-ifc (viewing and inspection, per the format matrix); IFC export and the full canonical entity mapping are not built yet. MPL-2.0 - keep isolated per §19.

`readIfcModel` (ARQ-160) is a prototype "viewer" - reading, per
`docs/interoperability/FORMAT-SUPPORT-MATRIX.md`'s stated IFC role
("Viewing and inspection"), not authoring or export. It reads spatial
structure (`IFCPROJECT`/`IFCSITE`/`IFCBUILDING`/`IFCBUILDINGSTOREY`/
`IFCSPACE`) plus common building elements (`IFCWALL`/`IFCDOOR`/`IFCWINDOW`/
`IFCSLAB`/`IFCCOLUMN`/`IFCBEAM`/`IFCROOF` - see `ifc-supported-types.ts`)
into a plain summary (express ID, IFC type, name, global ID). No geometry
is extracted, and no mapping into real `@arq/bim-core` elements happens
here - both are separate, later steps.

`buildIfcMappingReport` (ARQ-161) answers a different question than
`readIfcModel`'s own support report: of the IFC types this prototype can
read, which ones correspond to an Arq concept that actually exists in
`@arq/bim-core` today? "Mapped" means only that a concept exists to
eventually receive the data (Level, Room, WallType/WallInstance,
DoorType/DoorInstance, WindowType/WindowInstance, and the ProjectV0 root) -
it does not mean any conversion code exists, and this package still takes
no dependency on `@arq/bim-core` at all (per this issue's own non-goal
against coupling project semantics to an external-format class). Site,
Building, Slab, Column, Beam and Roof are honestly reported as
`'no-arq-concept-yet'`, hand-checked against `@arq/bim-core`'s real
current source, not assumed.

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

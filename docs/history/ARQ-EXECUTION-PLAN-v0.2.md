# Arq execution plan v0.2

**Document:** `ARQ-EXECUTION-PLAN-v0.2.md`
**Status:** Proposed execution companion to `ARQ-MASTER-PRODUCT-PLAN-v0.1.md`
**Date:** 21 July 2026
**Purpose:** Convert the current product vision into a buildable, testable and sequenced implementation plan
**Working product name:** Arq

---

## 1. What this document changes

The master product plan is a strong source of product direction, principles and long-term architecture. It is not yet narrow enough to start implementation safely.

This execution plan makes the following corrections:

1. Reduces the first product to one complete architectural workflow.
2. Separates the browser editor from future native capture features.
3. Defers real-time geometry co-authoring until the model operation system is stable.
4. Defers broad AI authoring until manual commands are deterministic and benchmarked.
5. Replaces an early microservice architecture with a modular monolith.
6. Treats OpenCascade as an evaluated dependency, not an automatic foundation for every modelling operation.
7. Makes 2D architectural semantics the authoritative first layer and derives 3D geometry from it.
8. Defines build gates, performance budgets, repository structure and issue order.
9. Locks the first design-system decisions required to produce consistent screens.
10. Identifies decisions that still require user research, prototype evidence or legal review.

The master plan remains the long-term source of truth. This file controls the order in which that plan is implemented.

---

# 2. Executive product decision

## 2.1 Product category

Arq will begin as a **browser-based architectural plan and lightweight BIM editor** for independent architects and small practices.

It will not begin as:

- a full AutoCAD replacement;
- a full Revit replacement;
- a general-purpose mechanical CAD application;
- an image generator;
- a rendering package;
- a construction management platform;
- a structural or MEP engineering tool.

## 2.2 First high-value workflow

The first complete workflow will be:

> Create or trace a small residential floor plan, convert it into editable architectural objects, inspect and modify those objects, view the result in coordinated 2D and 3D, add dimensions and room information, recover work safely, and export a clean PDF.

This workflow is narrow enough to build, but valuable enough to test whether Arq should become a larger CAD and BIM platform.

## 2.3 First target project

The benchmark project is a small residential renovation or new-build concept with:

- one building;
- one or two levels;
- exterior and interior walls;
- doors and windows;
- named rooms;
- dimensions;
- a simple 3D view;
- one printable plan sheet.

The first release is not validated against towers, hospitals, airports, infrastructure or multidisciplinary consultant models.

## 2.4 Platform order

1. Desktop-class web editor for Chrome, Edge and Safari on supported laptops.
2. Responsive iPad browser experience for viewing, drawing and editing the same small projects.
3. Installable progressive web application after offline behaviour is proven.
4. Native iPadOS application after the editor model and project format are stable.
5. macOS and Windows desktop shells after professional file handling and offline workflows are proven.
6. iPhone viewer, mark-up and site reference tool.
7. Native LiDAR capture as a separate iPadOS or iPhone capability, not part of the first editor milestone.

## 2.5 Why LiDAR is not the first build

LiDAR remains a potentially strong future differentiator, especially for renovation and existing-condition work. It should not determine the first architecture before the team proves that it can:

- create a reliable semantic wall model;
- maintain room boundaries;
- coordinate 2D and 3D;
- recover from failures;
- edit dimensions precisely;
- export dependable documents.

A scan that produces unreliable or difficult-to-edit geometry would not solve the user’s problem. The editable model must come first.

---

# 3. Locked product principles

The following decisions are locked for the first implementation unless an architecture decision record replaces them.

## 3.1 Semantic objects before free-form solids

Walls, openings, doors, windows and rooms are building objects with explicit properties and relationships. They are not anonymous meshes.

## 3.2 Plan-first authoring

The floor plan is the primary authoring surface in the first release. The 3D model is coordinated and editable where useful, but it is derived from the same building data.

## 3.3 Deterministic commands

Every manual and AI-assisted change must resolve to a typed model operation.

## 3.4 Local-first safety

A successful local operation is journalled before the interface reports it as safely committed. Cloud sync must not be required to protect ordinary edits.

## 3.5 Monochrome interface, not monochrome design content

Application chrome uses black, white and neutral greys.

The building model may use:

- material colours;
- imported drawing colours;
- analytical overlays;
- collaborator accents when enabled;
- print line weights and patterns.

## 3.6 Light appearance first

The first production editor ships with a light appearance only.

Dark mode is deferred until:

- all primary screens exist;
- technical drawings remain legible;
- selection and warning states are proven;
- visual regression coverage exists.

Building and testing two appearances before the workflow is stable doubles design and QA work without proving the product.

## 3.7 AI after command stability

AI may be prototyped early through tests and ArqScript, but it does not become a primary user feature until the equivalent manual operations are stable and undoable.

## 3.8 Review collaboration before co-authoring

The first collaboration release supports:

- shared viewing;
- comments;
- issues;
- presence;
- revision comparison.

Concurrent editing of the same geometry is deferred until typed operations, preconditions and conflict reporting are proven.

---

# 4. First release definition

## 4.1 Included

### Project

- Create project.
- Rename project.
- Choose metric or imperial units.
- Create one or two levels.
- Save locally.
- Restore after abnormal closure.
- Download an `.arq` archive.
- Reopen the archive.

### Canvas

- Pan.
- Zoom.
- Fit selection.
- Fit project.
- Grid display.
- Coordinate display.
- Selection window.
- Selection cycling.
- Keyboard shortcuts.
- Undo and redo.

### Drawing

- Reference image import.
- PDF underlay import after the image path is stable.
- Line.
- Polyline.
- Rectangle.
- Wall.
- Door.
- Window.
- Room.
- Dimension.
- Text note.

### Editing

- Move.
- Rotate.
- Copy.
- Delete.
- Trim wall.
- Extend wall.
- Split wall.
- Offset wall.
- Change wall thickness.
- Change wall height.
- Change door or window size.
- Flip door handing.
- Align selected elements.

### Snapping

- Endpoint.
- Midpoint.
- Intersection.
- Perpendicular.
- Grid.
- Extension.
- Nearest point as an optional lower-priority snap.

### Building model

- Straight walls.
- Basic joins for common right-angle and T intersections.
- Hosted doors and windows.
- Room boundary detection.
- Room name and area.
- Level association.
- Stable element IDs.
- Type and instance properties.

### Views

- Floor plan.
- Basic orthographic 3D.
- Perspective 3D navigation after orthographic navigation is stable.
- Synchronized selection between plan and 3D.
- Hide and isolate selection.

### Inspection

- Selected element type.
- Stable ID.
- Level.
- Dimensions.
- Host.
- Relationships.
- Inherited and overridden properties.
- Validation warnings.
- Operation history for the selected element.

### Documentation

- Linear dimensions.
- Room labels.
- Text notes.
- One simple plan sheet.
- Vector PDF export.
- Project and revision metadata.

### Reliability

- Local operation journal.
- Autosave.
- Crash recovery.
- Corrupt cache regeneration.
- Import transaction rollback.
- Export that cannot mutate project data.

## 4.2 Excluded

- Curved walls.
- Complex wall profiles.
- Curtain walls.
- Advanced roofs.
- Complex stairs.
- Families or a general component editor.
- Structural beams.
- MEP systems.
- Materials editor.
- Photorealistic rendering.
- Real-time geometry co-authoring.
- Native RVT import or export.
- DWG authoring.
- Full IFC authoring.
- Automatic code compliance.
- Natural-language generation in the public product.
- Image-to-CAD generation.
- LiDAR capture.
- Mobile phone authoring.
- Plugin marketplace.
- Public scripting API.

---

# 5. Success criteria for the first release

The first release is successful only when all of the following are true.

## 5.1 New-user task

A first-time user can:

1. create a project;
2. draw an exterior boundary;
3. add internal walls;
4. place a door and window;
5. define a room;
6. add a dimension;
7. inspect the wall thickness;
8. open the 3D view;
9. return to the plan;
10. export a PDF;

without reading external documentation.

## 5.2 Coordination task

Changing a wall position must update:

- the plan geometry;
- the generated 3D wall;
- hosted openings;
- adjacent room boundaries;
- relevant room areas;
- affected dimensions or dimension warnings.

## 5.3 Recovery task

After a forced browser termination, the project reopens at the last locally committed operation or explains exactly which operation was not committed.

## 5.4 Export task

The exported plan must:

- preserve scale;
- use vector linework;
- display dimensions correctly;
- include project and revision metadata;
- open in at least two independent PDF readers;
- match the golden visual reference within accepted tolerance.

## 5.5 Performance task

On the supported benchmark device, the benchmark house must meet the performance targets in this document.

---

# 6. Product research before feature expansion

## 6.1 Interview group

Conduct 12 to 18 structured interviews across:

- independent architects;
- practices with 2 to 10 people;
- architects working mainly on renovations;
- architects working mainly on small new-build residential work;
- architecture students;
- one or two BIM coordinators for interoperability context.

## 6.2 Interview method

Ask each participant to walk through one recent project.

Do not begin with “What features do you want?”

Capture:

- first information received;
- existing-condition input;
- first drawing created;
- repeated manual tasks;
- review loops;
- software switches;
- file exchanges;
- common errors;
- client deliverables;
- consultant deliverables;
- time lost;
- moments where work must be redone.

## 6.3 Required outputs

- Ranked top 10 workflows.
- Ranked top 10 frustrations.
- Current software stack by workflow.
- File formats exchanged.
- Typical small-project element count.
- Typical sheet count.
- Offline requirements.
- iPad usage.
- Keyboard and command usage.
- Trust level for AI changes.
- Willingness to try a browser editor.

## 6.4 Decision gate

Do not expand beyond the first residential plan workflow until at least eight target users confirm that the workflow is commercially relevant.

---

# 7. Design system decisions

## 7.1 Typography

### Interface

**Plus Jakarta Sans**

- 400 Regular
- 500 Medium
- 600 SemiBold
- 700 Bold only for major headings and empty-state marketing copy

### Technical values

**JetBrains Mono**

Use for:

- dimensions;
- coordinates;
- angles;
- units;
- IDs;
- command input;
- diagnostic information.

## 7.2 First type tokens

- `type.meta`: 11 px / 16 px, Jakarta 500
- `type.caption`: 12 px / 16 px, Jakarta 400
- `type.body`: 13 px / 18 px, Jakarta 400
- `type.control`: 14 px / 20 px, Jakarta 500
- `type.panel-title`: 16 px / 22 px, Jakarta 600
- `type.dialog-title`: 20 px / 28 px, Jakarta 600
- `type.page-title`: 28 px / 36 px, Jakarta 600
- `type.numeric-small`: 12 px / 16 px, JetBrains Mono 500
- `type.numeric`: 14 px / 20 px, JetBrains Mono 500

## 7.3 Colour tokens

- `paper`: `#FFFFFF`
- `surface-1`: `#FAFAFA`
- `surface-2`: `#F4F4F4`
- `surface-3`: `#ECECEC`
- `line-subtle`: `#E2E2E2`
- `line-default`: `#C7C7C7`
- `line-strong`: `#737373`
- `text-muted`: `#737373`
- `text-secondary`: `#555555`
- `text-primary`: `#151515`
- `ink`: `#000000`

Status is communicated by icon, label, pattern and border treatment. Colour is not the only carrier of meaning.

## 7.4 Geometry display rules

- Unselected model edges: medium neutral grey.
- Active drawing geometry: near black.
- Selected element: black outline, white handles, double-line or halo treatment.
- Hovered element: thin dashed preview.
- Locked element: diagonal pattern and lock icon.
- Invalid element: cross-hatch, warning icon and written reason.
- AI proposal later: marching dash, “Proposed” label and operation list.
- Underlay: reduced contrast, adjustable opacity, always visually distinct from authored geometry.

## 7.5 Spacing

Use a 4-point grid.

- 4 px: micro spacing
- 8 px: compact controls
- 12 px: normal control groups
- 16 px: panel padding
- 24 px: section spacing
- 32 px: major groups
- 48 px: page spacing

## 7.6 Corners

- Inputs and buttons: 4 px
- Popovers and menus: 6 px
- Dialogs: 8 px
- Floating iPad palette: 10 px maximum
- Pills only for compact status tags or segmented controls

## 7.7 Icon system

Use Lucide only as the temporary source for generic actions.

Create the Arq icon package with:

- one SVG source per icon;
- 24 × 24 viewBox;
- 1.75 px standard stroke;
- round caps;
- round joins unless technical meaning requires a mitre;
- no baked-in colour;
- accessible name;
- 16 px optical test;
- active-state test;
- high-density screen test.

## 7.8 First 40 custom technical icons

1. Select
2. Window select
3. Crossing select
4. Wall
5. Door
6. Window
7. Room
8. Level
9. Grid
10. Dimension
11. Text note
12. Move
13. Rotate
14. Copy
15. Mirror
16. Offset
17. Trim
18. Extend
19. Split
20. Align
21. Join
22. Plan view
23. 3D view
24. Orthographic
25. Perspective
26. Pan
27. Orbit
28. Fit view
29. Section placeholder
30. Elevation placeholder
31. Sheet
32. Inspect
33. Relationships
34. Warning
35. Model health
36. Revision
37. History
38. Comment
39. Export
40. Arq archive

## 7.9 Design deliverables before production UI

- Token package.
- Typography specimen.
- Icon construction sheet.
- Tool rail.
- Inspector.
- Top bar.
- Status bar.
- Context bar.
- Command palette.
- Empty project.
- Active wall tool.
- Selected wall.
- Invalid wall.
- 2D and 3D split view.
- iPad landscape layout.
- Keyboard shortcut overlay.

---

# 8. Interaction specification

## 8.1 Command model

Every tool follows the same lifecycle:

1. Idle.
2. Armed.
3. Previewing.
4. Awaiting numeric or pointer input.
5. Validated.
6. Committed.
7. Cancelled or failed.

The interface must always show which lifecycle state is active.

## 8.2 Escape behaviour

- First Escape clears an active handle or field.
- Second Escape cancels the current segment or sub-operation.
- Third Escape exits the tool.
- Escape from idle clears selection.
- Escape never deletes committed work.

## 8.3 Enter behaviour

Enter confirms only when the current preview is valid.

When invalid, Enter must:

- keep the operation uncommitted;
- show the reason;
- highlight the problem;
- preserve entered values.

## 8.4 Numeric entry

Typing while a tool is active opens a non-modal numeric overlay.

For a wall:

- length;
- angle;
- thickness if invoked;
- unit.

For a move:

- distance;
- angle;
- X and Y delta where appropriate.

The overlay must never cover the active cursor or the primary geometry preview.

## 8.5 Selection

- Click or Pencil tap selects the highest-priority eligible object.
- Tab cycles candidates.
- Shift adds or removes from selection.
- Drag left-to-right selects fully enclosed objects.
- Drag right-to-left selects intersected objects.
- Double click selects a logical parent or connected chain only where clearly defined.
- The status bar always shows selection count.
- The inspector states why a selected object cannot be edited.

## 8.6 Snapping

Snap computation is independent of rendering.

Each snap result contains:

- target point;
- snap type;
- source element;
- priority;
- screen distance;
- world distance where relevant;
- temporary constraint suggestion.

The visual snap glyph is rendered from this result.

## 8.7 Wall drawing

First wall tool behaviour:

1. Choose wall type.
2. Set start point.
3. Show dynamic preview.
4. Type length or click endpoint.
5. Continue chain or finish.
6. Compute join preview.
7. Validate self-intersection and minimum length.
8. Commit operation.

Wall alignment options:

- centreline;
- interior face;
- exterior face.

Only straight segments are included initially.

## 8.8 Door and window placement

- Hover previews the host wall.
- Placement shows offset and side.
- Door swing is visible before placement.
- Invalid placement explains wall-end clearance or overlap.
- Flip controls appear after selection.
- Resizing updates the hosted opening.

## 8.9 Room creation

Initial room engine supports:

- automatic closed-boundary detection;
- click inside a closed boundary;
- room name;
- room number optional;
- calculated area;
- warning when boundary is open;
- boundary highlight on hover.

---

# 9. Technical architecture correction

## 9.1 Start with a modular monolith

Do not begin with six independent backend services.

Initial deployable units:

1. `apps/web`
2. `apps/marketing`
3. `apps/api`
4. one asynchronous worker process for heavy imports and exports when required

Shared packages remain modular, but deployment stays simple.

## 9.2 Proposed initial repository

```text
arq/
├── apps/
│   ├── web/
│   ├── marketing/
│   └── api/
├── packages/
│   ├── design-system/
│   ├── icons/
│   ├── editor-shell/
│   ├── command-system/
│   ├── input-system/
│   ├── plan-renderer/
│   ├── model-renderer/
│   ├── geometry-2d/
│   ├── geometry-3d/
│   ├── bim-core/
│   ├── operations/
│   ├── project-format/
│   ├── local-storage/
│   ├── validation/
│   ├── pdf-export/
│   └── test-models/
├── workers/
│   ├── geometry-worker/
│   └── import-export-worker/
├── docs/
│   ├── product/
│   ├── execution/
│   ├── adr/
│   ├── ux/
│   ├── schemas/
│   ├── licensing/
│   └── research/
├── benchmarks/
├── scripts/
├── .github/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── README.md
├── LICENSE
├── NOTICE
├── SECURITY.md
└── CONTRIBUTING.md
```

## 9.3 Frontend

- TypeScript with strict mode.
- React for interface panels and application shell.
- Vite for the editor application.
- Canvas or SVG for early 2D prototypes, selected after benchmark.
- Three.js for 3D scene management.
- WebGL first with an isolated WebGPU capability path.
- Zustand or an equivalent small store for interface state.
- Model state outside React.
- Web Workers for geometry, room boundaries and heavy serialisation.
- IndexedDB for local project journal and snapshots.

## 9.4 Authoritative 2D geometry

The first architectural model can be represented authoritatively through:

- wall axes or reference lines;
- thickness;
- height;
- level;
- alignment;
- join intent;
- opening positions;
- room boundary relationships.

The 3D wall solids are derived from this semantic definition.

Do not make a generated triangle mesh authoritative.

## 9.5 OpenCascade decision

OpenCascade.js must be evaluated, but it should not be required for the first wall-room vertical slice.

Use it only when it proves necessary for:

- robust solid booleans beyond simple hosted openings;
- STEP exchange;
- generic component solids;
- complex intersections;
- future free-form geometry.

A simple residential wall system can be built and validated with dedicated planar geometry and mesh generation. This reduces bundle size, worker latency and debugging complexity.

## 9.6 2D geometry requirements

The geometry package must support:

- robust line intersection;
- segment intersection;
- point-on-segment;
- polygon winding;
- polygon area;
- offset polylines;
- polygon union and difference where needed;
- point-in-polygon;
- nearest point;
- tolerance-aware equality;
- room boundary graph construction.

All functions must define tolerance behaviour explicitly.

## 9.7 Model operation architecture

Use typed operations, but do not require full event sourcing in the first release.

Store:

- current project snapshot;
- append-only local operation journal since the snapshot;
- undo payloads for eligible operations;
- periodic compacted snapshots;
- server revision sequence after sync exists.

This keeps recovery and auditability without making every read depend on replaying the entire project history.

## 9.8 Operation contract

```ts
interface ModelOperation<TPayload, TResult> {
  id: string;
  type: string;
  actorId: string;
  projectId: string;
  baseRevision: number;
  timestamp: string;
  payload: TPayload;
  preconditions: OperationPrecondition[];
  apply(context: OperationContext): OperationResult<TResult>;
  invert(result: TResult): ModelOperation<unknown, unknown>;
}
```

Every operation result includes:

- success or failure;
- affected IDs;
- validation messages;
- derived data invalidations;
- undo information;
- performance timing.

## 9.9 Project format

Version 0 of the `.arq` format should contain:

```text
project.arq
├── manifest.json
├── model.json
├── operations.ndjson
├── views.json
├── sheets.json
├── imports/
├── thumbnails/
└── checksums.json
```

Use JSON initially for inspectability and development speed.

Move selected large structures to MessagePack or another binary format only after profiling demonstrates a need.

## 9.10 Backend

Initial backend responsibilities:

- authentication;
- workspace and project metadata;
- permissions;
- project snapshot upload and download;
- operation sync;
- export jobs;
- audit events.

Initial infrastructure:

- PostgreSQL;
- S3-compatible object storage;
- one queue if asynchronous export is required;
- no Redis until a measured requirement appears;
- no geometry microservice until browser or worker limits are demonstrated.

---

# 10. Data model v0

## 10.1 Project

```ts
interface Project {
  id: ProjectId;
  schemaVersion: number;
  name: string;
  units: UnitSystem;
  precision: PrecisionSettings;
  levels: LevelId[];
  elementIds: ElementId[];
  viewIds: ViewId[];
  sheetIds: SheetId[];
  revision: number;
}
```

## 10.2 Level

```ts
interface Level {
  id: LevelId;
  name: string;
  elevation: Length;
  storeyHeight?: Length;
}
```

## 10.3 Wall type

```ts
interface WallType {
  id: WallTypeId;
  name: string;
  thickness: Length;
  defaultHeight: Length;
  function: 'exterior' | 'interior' | 'unknown';
}
```

## 10.4 Wall instance

```ts
interface Wall {
  id: WallId;
  typeId: WallTypeId;
  levelId: LevelId;
  start: Point2;
  end: Point2;
  alignment: 'centre' | 'interior' | 'exterior';
  heightOverride?: Length;
  joinStart: WallJoinIntent;
  joinEnd: WallJoinIntent;
  hostedOpeningIds: OpeningId[];
}
```

## 10.5 Opening

```ts
interface Opening {
  id: OpeningId;
  hostWallId: WallId;
  kind: 'door' | 'window' | 'void';
  offsetFromWallStart: Length;
  width: Length;
  sillHeight: Length;
  height: Length;
}
```

## 10.6 Room

```ts
interface Room {
  id: RoomId;
  levelId: LevelId;
  seedPoint: Point2;
  name: string;
  number?: string;
  boundaryElementIds: ElementId[];
  calculatedBoundary: Polygon2;
  calculatedArea: Area;
  status: 'valid' | 'not-enclosed' | 'overlapping' | 'invalid';
}
```

## 10.7 Dimension

```ts
interface LinearDimension {
  id: DimensionId;
  levelId: LevelId;
  references: DimensionReference[];
  witnessOffset: Length;
  textOverride?: string;
}
```

---

# 11. Derived-data graph

Each operation declares which derived systems may be stale.

Example wall move invalidates:

- wall 2D outline;
- wall 3D mesh;
- connected wall joins;
- hosted opening placement;
- adjacent room boundaries;
- room areas;
- dimensions referencing the wall;
- plan display cache;
- 3D display cache;
- sheet viewport cache.

Recalculation should be dependency-driven, not “regenerate the entire project”.

---

# 12. Validation framework

## 12.1 Validation levels

- Information
- Warning
- Blocking error

## 12.2 Blocking examples

- Wall length below minimum tolerance.
- Door wider than available host segment.
- Opening overlaps another opening.
- Invalid numeric value.
- Non-finite coordinate.
- Operation based on a deleted element.
- Project schema version unsupported.

## 12.3 Warning examples

- Room is not enclosed.
- Door is very close to wall end.
- Wall overlap may be unintended.
- Dimension reference became detached.
- Imported underlay is uncalibrated.

## 12.4 Error object

```ts
interface ValidationMessage {
  id: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
  title: string;
  explanation: string;
  affectedElementIds: ElementId[];
  suggestedActions: SuggestedAction[];
  technicalDetails?: string;
}
```

Normal users see the title, explanation and suggested actions. Developer mode may show technical details.

---

# 13. Rendering plan

## 13.1 2D plan renderer

The plan renderer must prioritise:

- crisp lines at every zoom;
- stable screen-space line weight;
- accurate hit testing;
- large model culling;
- high-quality text and dimensions;
- vector export compatibility.

Run a short spike comparing:

- Canvas 2D;
- SVG;
- WebGL line rendering;
- a hybrid approach.

Selection should not depend on pixel colour picking alone.

## 13.2 3D renderer

Initial 3D features:

- generated wall meshes;
- door and window voids;
- simple floor slab;
- orthographic camera;
- orbit;
- pan;
- zoom;
- selection outline;
- hide;
- isolate;
- fit view;
- basic ambient and directional lighting;
- no materials editor;
- no photorealism.

## 13.3 Split view

After single-view stability:

- plan and 3D side-by-side;
- shared selection;
- shared operation history;
- no automatic camera movement unless the user invokes “focus selection”;
- throttled inactive view updates.

---

# 14. Performance budgets

## 14.1 Supported benchmark model

- 2 levels.
- 150 walls.
- 80 doors and windows.
- 60 rooms.
- 200 dimensions and annotations.
- 1 calibrated underlay.
- Approximately 1,000 semantic objects.

## 14.2 Initial targets

- Canvas initial interaction: under 2 seconds after project data is locally available.
- Selection response: median under 50 ms.
- Hover response: median under 32 ms.
- Pan and zoom: 60 fps target.
- 3D orbit: 60 fps target on the benchmark model.
- Wall commit: median under 100 ms excluding network sync.
- Room recalculation after one wall move: median under 150 ms.
- Undo common operation: median under 150 ms.
- Local journal write: under 100 ms.
- PDF export for benchmark project: under 5 seconds locally or with visible progress.
- Memory: remain below a documented safe threshold for each supported browser and device.

## 14.3 CI budgets

Fail or flag a pull request when it causes:

- more than 10% regression in a protected benchmark;
- significant bundle growth without explanation;
- main-thread tasks over the defined threshold;
- visual regression in protected golden screens;
- project format incompatibility without migration.

---

# 15. Testing plan

## 15.1 Unit

- units;
- points and vectors;
- line intersection;
- wall outline generation;
- wall join generation;
- opening validation;
- room boundary detection;
- room area;
- dimension references;
- operation apply and invert;
- archive checksums;
- schema migration.

## 15.2 Property-based

- operation followed by inverse restores state;
- serialise and parse preserves IDs;
- wall endpoint order does not change physical wall;
- polygon area remains stable under translation;
- room boundary does not self-intersect for valid benchmark layouts;
- invalid numeric input never commits.

## 15.3 Golden projects

1. Single rectangular room.
2. L-shaped room.
3. Two rooms sharing a wall.
4. Corridor with repeated doors.
5. T-junction walls.
6. Cross-junction walls.
7. Door near wall end.
8. Overlapping openings.
9. Two-level small house.
10. Imported image underlay.

## 15.4 Visual regression

- empty editor;
- active wall preview;
- snap states;
- overlapping selection cycle;
- selected wall;
- selected door;
- invalid room;
- inspector states;
- plan and 3D split;
- sheet export preview;
- iPad landscape;
- 200% browser zoom.

## 15.5 Recovery

Automated tests must simulate:

- browser termination after local commit;
- termination during preview;
- corrupt render cache;
- incomplete imported file;
- failed export;
- project schema migration failure.

---

# 16. Accessibility baseline

- All commands available by keyboard.
- Visible focus treatment.
- No colour-only status.
- Touch targets at least 44 points on iPad.
- Screen-reader names for controls.
- Inspector property groups use semantic headings.
- Command palette results announce count and active result.
- Reduced motion respected.
- Browser zoom to 200% without losing core commands.
- Error messages connect to the affected field and canvas object.
- Technical canvas accessibility documented honestly where full screen-reader geometry interaction is not yet supported.

---

# 17. Interoperability sequence

## 17.1 Stage 1

- PDF underlay import.
- Image underlay import.
- Vector PDF export.
- `.arq` archive.

## 17.2 Stage 2

- DXF linework import.
- DXF linework export.
- Clear layer mapping report.
- No claim of full DWG support.

## 17.3 Stage 3

- IFC viewing and property inspection.
- Import report.
- Stable source identifiers.
- Selected architectural entity mapping.

## 17.4 Stage 4

- Controlled IFC export for the supported Arq entity subset.
- Published support matrix.
- Independent viewer validation.
- Round-trip tests without claiming complete losslessness.

---

# 18. Collaboration sequence

## 18.1 First collaboration release

- Share link.
- Viewer role.
- Commenter role.
- Editor role with single-editor or controlled locking if needed.
- Presence.
- Model-location comments.
- Sheet comments.
- Issue status.
- Revision snapshots.

## 18.2 Later co-authoring

Before simultaneous geometry editing:

- operations have server-verifiable preconditions;
- element conflict states are designed;
- undo behaviour is defined;
- offline reconciliation is tested;
- destructive conflicts are never silently merged;
- design-option branching exists for major alternatives.

---

# 19. AI sequence

## 19.1 Internal only

Build ArqScript and command benchmarks behind developer flags.

Version 0 supports:

- create level;
- create wall;
- update wall;
- place door;
- place window;
- create room;
- add dimension.

## 19.2 First user-facing AI feature

The safest first AI feature is not full plan generation.

Start with:

> Explain the selected object, its relationships, its warnings and the likely effect of changing a property.

This creates value while using trusted project data and avoiding uncontrolled geometry generation.

## 19.3 Second user-facing feature

Natural language to one bounded edit:

- “Change these walls to 150 mm.”
- “Move this door 300 mm to the left.”
- “Rename these rooms using the selected list.”
- “Add dimensions to the selected wall chain.”

Every proposal shows:

- parsed intent;
- assumptions;
- affected elements;
- exact operations;
- visual preview;
- validation result;
- apply and reject.

## 19.4 Full generation gate

Do not offer “design a house” until benchmarks show:

- dimensional accuracy;
- room closure;
- valid wall joins;
- no overlapping openings;
- explicit assumptions;
- predictable undo;
- meaningful time saved after user corrections.

---

# 20. Repository governance

## 20.1 Branches

- Protected `main`.
- Short-lived feature branches.
- Draft pull requests for early work.
- No permanent `develop` branch initially.

## 20.2 Pull request template

Every pull request includes:

- problem;
- scope;
- non-goals;
- screenshots or recording;
- test evidence;
- performance effect;
- accessibility effect;
- project format effect;
- migration effect;
- dependency and licence effect;
- rollback plan for risky changes.

## 20.3 Labels

### Type

- `type: feature`
- `type: bug`
- `type: research`
- `type: refactor`
- `type: docs`
- `type: performance`
- `type: security`

### Area

- `area: editor`
- `area: input`
- `area: 2d`
- `area: 3d`
- `area: bim`
- `area: operations`
- `area: storage`
- `area: export`
- `area: design-system`
- `area: accessibility`
- `area: infrastructure`

### Priority

- `priority: critical`
- `priority: high`
- `priority: normal`
- `priority: later`

### State

- `state: needs-research`
- `state: ready`
- `state: blocked`
- `state: in-progress`
- `state: needs-review`

## 20.4 Architecture decisions required first

1. ADR-001 Web-first editor.
2. ADR-002 Plan-first semantic model.
3. ADR-003 Modular monolith.
4. ADR-004 Typed operations and snapshots.
5. ADR-005 2D renderer.
6. ADR-006 3D renderer.
7. ADR-007 OpenCascade boundary.
8. ADR-008 Project archive format.
9. ADR-009 Local-first journal.
10. ADR-010 Collaboration staging.
11. ADR-011 AI operation model.
12. ADR-012 Licensing policy.

---

# 21. Build phases

## Phase 0: Product and technical validation

### Deliverables

- Interview synthesis.
- Competitive workflow recordings.
- Name clearance report.
- Supported-device matrix.
- 2D renderer spike.
- OpenCascade.js spike.
- IndexedDB journal spike.
- Project format draft.
- Clickable desktop prototype.
- Clickable iPad landscape prototype.

### Exit gate

The team can defend:

- first user;
- first workflow;
- first project size;
- first platform;
- first export;
- technical renderer choice.

## Phase 1: Editor kernel

### Deliverables

- Canvas coordinates.
- Pan and zoom.
- Selection.
- Snapping.
- Numeric entry.
- Command lifecycle.
- Undo and redo.
- Local persistence.
- Design system package.
- First 20 icons.

### Exit gate

A user can draw and edit accurate linework with reliable undo after reopening the project.

## Phase 2: Architectural vertical slice

### Deliverables

- Levels.
- Wall type and instance.
- Wall tool.
- Wall joins.
- Door and window hosting.
- Room boundaries.
- Inspector.
- Generated 3D walls.
- Synchronized selection.

### Exit gate

Moving one wall correctly updates the room, opening positions and 3D geometry.

## Phase 3: Documentation

### Deliverables

- Linear dimensions.
- Room labels.
- Text notes.
- One sheet.
- Vector PDF export.
- Revision metadata.

### Exit gate

The benchmark house produces a clean, scaled PDF suitable for review.

## Phase 4: Reliability and beta readiness

### Deliverables

- Crash recovery.
- Corrupt cache recovery.
- Performance diagnostics.
- Benchmark CI.
- Accessibility baseline.
- Error explanations.
- Project archive download and restore.
- Privacy-conscious analytics.

### Exit gate

No known data-loss defect remains in the protected workflow.

## Phase 5: Exchange

### Deliverables

- DXF linework exchange.
- IFC viewing.
- Import reports.
- Support matrix.
- Golden external files.

### Exit gate

Users understand what was preserved, converted or unsupported.

## Phase 6: Review collaboration

### Deliverables

- Shared viewer.
- Comments.
- Issues.
- Presence.
- Revisions.
- Roles.

### Exit gate

A project can be reviewed by a client or teammate without installing specialist software.

## Phase 7: Bounded AI

### Deliverables

- ArqScript v0.
- Explain selection.
- One-step modification proposals.
- Preview.
- Validation.
- Grouped undo.
- Benchmark dashboard.

### Exit gate

Selected AI tasks save measurable time without increasing model errors.

## Phase 8: Native iPad capability

### Deliverables

- Native shell or app.
- Files integration.
- Strong offline storage.
- Pencil hover.
- Double tap.
- Squeeze where available.
- Haptic snap feedback where available.
- Native capture research.

### Exit gate

The iPad experience is measurably better than the browser for the supported workflow.

---

# 22. First 50 ordered issues

## Foundation

1. `docs: add execution plan v0.2`
2. `docs: create architecture decision record template`
3. `docs: add dependency and licence policy`
4. `chore: initialise pnpm monorepo`
5. `chore: configure TypeScript strict mode`
6. `chore: configure formatting and linting`
7. `chore: add unit-test runner`
8. `chore: add pull-request template`
9. `chore: add issue templates`
10. `chore: add protected benchmark workflow`

## Design system

11. `design: create monochrome token package`
12. `design: add Plus Jakarta Sans and JetBrains Mono typography tokens`
13. `design: create icon package and SVG rules`
14. `design: draw select wall door window room icons`
15. `design: build tool rail component`
16. `design: build inspector shell`
17. `design: build status bar`
18. `design: build command palette shell`

## Core editor

19. `editor: define world and screen coordinate systems`
20. `editor: implement pan and zoom`
21. `editor: implement pointer keyboard touch input abstraction`
22. `editor: implement command lifecycle state machine`
23. `editor: implement selection hit-test interface`
24. `editor: implement window and crossing selection`
25. `editor: implement overlapping selection cycling`
26. `editor: implement snap-result contract`
27. `editor: implement endpoint and midpoint snaps`
28. `editor: implement intersection and perpendicular snaps`
29. `editor: implement numeric-entry overlay`
30. `editor: implement undo and redo command stack`

## Project and operations

31. `core: define UUIDv7 identifier types`
32. `core: define project schema v0`
33. `core: define typed operation contract`
34. `core: implement create update delete operation tests`
35. `storage: create IndexedDB project store`
36. `storage: create append-only local operation journal`
37. `storage: implement periodic snapshots`
38. `storage: implement abnormal-closure recovery test`
39. `format: define .arq manifest and checksums`
40. `format: implement .arq export and import`

## Architectural slice

41. `bim: define level schema`
42. `bim: define wall type and instance schemas`
43. `geometry: implement straight wall outline`
44. `editor: implement wall drawing tool`
45. `geometry: implement right-angle wall join`
46. `bim: define hosted opening schema`
47. `editor: implement door placement`
48. `editor: implement window placement`
49. `bim: implement room boundary graph prototype`
50. `renderer: generate coordinated 3D wall meshes`

The next issue batch should cover room editing, dimensions, inspector details, PDF export, performance and recovery.

---

# 23. Decisions intentionally deferred

- Exact pricing.
- Public launch date.
- Dark mode.
- Native iPad implementation technology.
- Desktop shell technology.
- Full OpenCascade integration.
- Full IFC export scope.
- DWG support.
- Concurrent geometry editing.
- LiDAR capture.
- Material and rendering system.
- Plugin SDK.
- Public API.
- Marketplace.
- Code compliance.
- Structural or MEP features.

These decisions should not block the first editor slice.

---

# 24. Risks and mitigations

## Scope growth

**Risk:** Every architectural workflow appears necessary.

**Mitigation:** No feature enters the first release unless it supports the benchmark residential plan workflow.

## Browser limitations

**Risk:** Browser memory, input or file access becomes insufficient.

**Mitigation:** Measure before rewriting. Keep geometry and project packages portable to native workers and shells.

## Geometry fragility

**Risk:** Wall joins, room boundaries or openings fail on ordinary plans.

**Mitigation:** Golden models, explicit tolerances, highlighted failures and unchanged state after invalid operations.

## Architectural semantics become tied to rendering

**Risk:** Editor logic begins depending on Three.js objects or display meshes.

**Mitigation:** Strict package boundaries and architecture tests.

## Event-log complexity

**Risk:** Full event sourcing slows development.

**Mitigation:** Snapshots plus append-only recovery journal, not replay-only architecture.

## Premature collaboration complexity

**Risk:** CRDT and geometry conflict work delays the editor.

**Mitigation:** Review collaboration first.

## Premature AI complexity

**Risk:** AI produces demonstrations before the manual editor is dependable.

**Mitigation:** Internal ArqScript benchmarks, then bounded user-facing edits.

## Licensing mistakes

**Risk:** Code, weights, datasets or libraries are reused under incompatible terms.

**Mitigation:** SPDX policy, SBOM, CI scanning and legal review before distribution.

## Monochrome ambiguity

**Risk:** Status and multi-user identity become difficult to distinguish.

**Mitigation:** Labels, patterns, icons, line styles and optional accessibility accents.

---

# 25. Definition of done

A feature is complete only when:

- its user problem is stated;
- interaction states are designed;
- empty, loading, invalid and failure states exist;
- keyboard behaviour exists;
- iPad touch behaviour is considered;
- typed operations exist;
- undo behaviour exists;
- local persistence is tested;
- validation messages are written;
- unit tests pass;
- visual regression exists where relevant;
- performance effect is measured;
- accessibility is reviewed;
- documentation is updated;
- dependency and licence effects are recorded.

---

# 26. Immediate repository changes

Add:

```text
docs/execution/ARQ-EXECUTION-PLAN-v0.2.md
docs/adr/0000-template.md
docs/licensing/DEPENDENCY-POLICY.md
docs/research/INTERVIEW-GUIDE.md
docs/research/WORKFLOW-SYNTHESIS-TEMPLATE.md
docs/ux/COMMAND-LIFECYCLE.md
docs/ux/SELECTION-AND-SNAPPING.md
docs/schemas/PROJECT-SCHEMA-v0.md
docs/schemas/OPERATION-CONTRACT-v0.md
benchmarks/README.md
```

Update the root README so that:

- the master plan remains the long-term product source;
- the execution plan controls implementation order;
- earlier drafts remain historical;
- repository status clearly states that implementation has not begun until the monorepo exists.

---

# 27. Immediate next actions

1. Add this execution plan to the repository.
2. Create the first 12 ADRs.
3. Create the first 50 ordered issues.
4. Run the architect workflow interview programme.
5. Build desktop and iPad clickable prototypes.
6. Benchmark Canvas 2D, SVG, WebGL and hybrid plan rendering.
7. Build a local operation journal spike.
8. Build one wall-room-3D technical spike without OpenCascade.
9. Run OpenCascade.js separately against operations that may genuinely need it.
10. Produce the first `.arq` project archive and reopen it.
11. Create the design token package.
12. Draw and test the first 20 technical icons.
13. Define supported benchmark devices.
14. Add the first ten golden model fixtures.
15. Do not begin collaboration, AI generation or LiDAR implementation before the architectural vertical slice passes its gate.

---

# 28. Final execution direction

Arq should be built as a sequence of dependable architectural capabilities.

The first proof is not a large feature list. It is a small project in which:

- walls behave predictably;
- doors and windows remain hosted;
- rooms remain understandable;
- plan and 3D remain coordinated;
- dimensions remain trustworthy;
- work survives a crash;
- the file can be downloaded;
- the PDF looks professional;
- every failure explains itself.

Once that foundation works, collaboration, AI, exchange, native iPad features and broader BIM depth can be added without reproducing the same complexity Arq is intended to remove.

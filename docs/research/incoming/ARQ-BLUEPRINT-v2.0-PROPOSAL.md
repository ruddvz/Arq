# Arq complete product, UX, file-system and engineering blueprint v2.0

**Status:** Current source of truth
**Date:** 21 July 2026
**Supersedes:** v1.0 and v1.1

## Binding interpretation

Where older documents conflict with this blueprint, the following order controls:

1. Approved ADRs numbered 0019 and later
2. `docs/file-system/`
3. This v2.0 blueprint
4. Package and component specifications
5. Historical documents

## Corrections made in v2.0

- Removed Dexie as the primary project store.
- Removed JSON and ZIP as the primary `.arq` representation.
- Prohibited deprecated SQLite Worker1 and Promiser APIs.
- Defined a direct SQLite-library Worker boundary.
- Made the browser VFS an evidence-based selection.
- Locked WebGLRenderer as the Release 1 production path.
- Added a runnable `.arq` reference implementation and sample project.
- Added complete command, feature and entity catalogues.
- Added measurable performance, memory, network and bundle budgets.
- Added a master bug-to-fix register and contradiction audit.
- Added execution workstreams, ownership and exit gates.

---
> **Superseded for storage and project-format decisions.** The current source is `docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v2.0.md`, ADR-0019 through ADR-0025, and `docs/file-system/`.

# Arq complete product, UX, architecture and engineering blueprint

**Document:** `ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md`
**Status:** Proposed consolidated source of truth
**Date:** 21 July 2026
**Working product name:** Arq
**Scope:** Product definition, user research, feature specification, UI and UX, design system, geometry, BIM, rendering, storage, collaboration, AI, interoperability, native platforms, security, testing, operations, open-source strategy and execution backlog

> This document consolidates and expands the earlier master product plan and execution plan. Earlier files should remain in the repository for history, but this file should control current product and implementation decisions once approved.

---

## Document hierarchy

1. This blueprint controls implementation scope, component behaviour and acceptance gates.
2. Architecture Decision Records control decisions that have been formally approved.
3. Package-level specifications control implementation details within their stated boundary.
4. Earlier planning documents remain historical and must not silently override this blueprint.
5. Any contradiction must be resolved through an ADR and reflected in the next blueprint revision.

## Decision labels used in this document

- **Locked:** Use this choice unless an ADR replaces it.
- **Recommended:** Current preferred choice, pending a focused technical spike.
- **Spike:** Build a limited prototype and measure before selecting.
- **Reference only:** Study behaviour or architecture. Do not copy directly.
- **Deferred:** Intentionally excluded from the current product stage.
- **Prohibited:** Do not implement without an explicit change in product direction or legal approval.

## Important limitation

No planning document can predict every geometric edge case, browser defect, imported file variation, professional workflow or future regulation. The correct way to make the plan complete is not to pretend that uncertainty does not exist. It is to define:

- what is locked;
- what must be measured;
- what must be researched;
- what must fail safely;
- which claims must not be made;
- which evidence is required before expanding scope.

That approach is used throughout this blueprint.


# Part I. Product definition

## 1. Product thesis

Arq will begin as a browser-based architectural plan and lightweight BIM editor for independent architects and small practices.

The first useful product will help a user:

1. create or trace a small residential floor plan;
2. turn plan geometry into semantic architectural objects;
3. inspect and modify those objects;
4. see a coordinated 3D representation;
5. add rooms, dimensions and notes;
6. recover work after interruption;
7. export a clean scaled PDF;
8. retain an open local project archive.

Arq is not initially a full AutoCAD, Revit, Archicad, SketchUp, Rhino or Blender replacement.

## 2. First target user

### Primary

Independent architects and architecture practices with approximately 1 to 10 people working mainly on:

- houses;
- apartments;
- small renovations;
- interior architecture;
- small retail;
- small offices;
- early design and drawing coordination.

### Secondary

- architecture students;
- interior designers;
- design-build teams;
- project reviewers;
- clients;
- consultants who need viewing, measurements and comments.

### Not targeted initially

- large infrastructure programmes;
- multidisciplinary hospital or airport teams;
- fabrication-detail modellers;
- structural analysis teams;
- MEP design teams;
- contractors requiring mature 4D or 5D workflows;
- organisations requiring complete RVT compatibility;
- users expecting every AutoCAD command.

## 3. First benchmark project

The protected benchmark project is a small two-level house containing:

- 150 straight walls;
- 80 doors and windows;
- 60 rooms;
- 200 dimensions, labels and notes;
- one calibrated underlay;
- one plan sheet;
- approximately 1,000 semantic objects.

The first authoring promise applies only to project sizes that pass the published benchmark suite.

## 4. First complete workflow

The first complete workflow is:

> New project to dimensioned residential plan to coordinated 3D to scaled PDF.

A release is not considered useful merely because isolated tools exist. The entire workflow must be dependable.

## 5. Product principles

1. The model is inspectable.
2. The user controls every committed change.
3. Plan and 3D represent the same building objects.
4. Every action is reversible where technically meaningful.
5. Invalid operations leave the project unchanged.
6. Performance is part of product quality.
7. Local recovery is not dependent on cloud availability.
8. File exchange is explicit about loss and conversion.
9. AI proposes typed operations rather than editing hidden geometry.
10. The interface is monochromatic, but the designed building is not forced to be monochromatic.
11. Touch, Pencil, keyboard and mouse have distinct interaction rules.
12. The project model is independent from any renderer or external format.
13. Arq must never claim professional approval, code compliance or structural safety.
14. Complexity appears progressively.
15. Export and data access must not become coercive lock-in mechanisms.

## 6. Product anti-goals

Arq must not become:

- a generic drawing whiteboard with architectural icons;
- a chat interface that generates uneditable images;
- an IFC viewer presented as a BIM authoring platform;
- a desktop ribbon interface compressed into an iPad screen;
- a cloud-only file that becomes inaccessible when billing stops;
- a collection of open-source projects glued together without one semantic model;
- a renderer whose mesh objects become authoritative project data;
- an AI demo that cannot explain or undo its work;
- a “Revit clone” with the same hidden relationships and vague errors.


## 7. Scope map

### Release 1: dependable authoring

Included:

- project setup;
- metric and imperial units;
- levels;
- reference image import;
- PDF underlay after image underlay stabilises;
- line and polyline;
- straight walls;
- doors;
- windows;
- rooms;
- linear dimensions;
- text notes;
- floor plan;
- basic orthographic 3D;
- selection synchronisation;
- inspector;
- local journal;
- crash recovery;
- `.arq` archive;
- one plan sheet;
- vector PDF export.

Excluded:

- curved walls;
- complex roofs;
- advanced stairs;
- parametric family editor;
- photorealistic rendering;
- simultaneous geometry editing;
- public AI generation;
- LiDAR;
- full IFC authoring;
- DWG authoring;
- direct RVT support;
- structural or MEP systems.

### Release 2: exchange and review

- DXF linework import and export;
- IFC viewing and property inspection;
- transparent import reports;
- share links;
- comments;
- issues;
- revision comparison;
- viewer and commenter roles.

### Release 3: bounded AI and deeper documentation

- ArqScript v0;
- explain selection;
- single-step change proposals;
- door, window and room schedules;
- sections and elevations after generation quality passes;
- controlled IFC export for a published subset.

### Release 4: native iPad value

- native file handling;
- stronger offline storage;
- Apple Pencil hover;
- double tap;
- squeeze on supported Pencil hardware;
- haptic snap feedback where supported;
- RoomPlan and LiDAR research prototype;
- site mark-up workflow.

### Later professional expansion

- design options;
- renovation phases;
- advanced stairs;
- roofs;
- component library;
- BCF;
- consultant links;
- plugin SDK;
- desktop shells;
- advanced rendering integrations;
- selected analysis integrations.


# Part II. User research and product evidence

## 8. Known qualitative complaints

Current community discussions repeatedly describe the following problems:

- Revit is necessary for many jobs, but users describe it as clunky and frustrating.
- Wall joins, stairs, railings, title blocks, parameters, visibility and printing create recurring friction.
- AutoCAD users complain about latency in basic operations such as hatches and about dependence on DWG.
- Small firms object to subscriptions, platform lock-in and software stagnation.
- Users still value the incumbent ecosystem, documentation depth, plugins and industry compatibility.
- A credible competitor therefore needs a focused workflow advantage, not a superficial redesign.

These findings are qualitative. They must not be turned into invented market percentages.

## 9. Interview programme

Conduct 12 to 18 interviews before expanding beyond the first workflow.

### Participant mix

- 4 independent architects;
- 4 architects from practices with 2 to 10 people;
- 3 renovation-focused practitioners;
- 2 architecture students;
- 2 BIM coordinators;
- 1 interior architect;
- optional client or reviewer participants.

### Method

Ask each person to demonstrate one recent project.

Record:

- first inputs received;
- measured survey process;
- software used at each stage;
- repeated actions;
- manual rework;
- review loops;
- consultant exchanges;
- common failures;
- deliverables;
- time-sensitive operations;
- iPad use;
- offline use;
- command-line or shortcut habits;
- trust in automated changes.

### Required synthesis

- top 10 workflows;
- top 10 failures;
- top 10 repetitive operations;
- software-switch map;
- file-format map;
- typical small-project object count;
- typical sheet count;
- most common import;
- most common export;
- must-have keyboard commands;
- accepted and rejected AI tasks;
- browser willingness;
- iPad value;
- willingness to pay, researched separately from feature interviews.

## 10. Research rules

- Observe completed work, not only stated preferences.
- Separate user frequency from user frustration.
- Do not build a rare expert feature because one interview is enthusiastic.
- Do not ignore a low-frequency failure when it risks data loss.
- Record current workaround and cost.
- Keep quotes with permission and context.
- Do not publish confidential project details.
- Revisit the same participants after the clickable prototype.


# Part III. Product experience architecture

## 11. Workspace modes

### Design

Purpose:

- create and modify building objects;
- work mainly in plan and 3D;
- access drawing, transform and building tools.

### Document

Purpose:

- dimensions;
- notes;
- tags;
- schedules;
- sheets;
- revisions;
- print settings.

### Inspect

Purpose:

- properties;
- type and instance inheritance;
- relationships;
- constraints;
- source provenance;
- warnings;
- operation history.

### Review

Purpose:

- comments;
- issues;
- revision comparison;
- approval status;
- shared viewing.

### Present

Purpose:

- clean navigation;
- saved views;
- diagram display;
- client review;
- no accidental editing.

Modes change the visible tools. They do not create separate data copies.

## 12. Desktop shell

### Top application bar

Contains:

- Arq mark;
- project name;
- branch or design option later;
- undo;
- redo;
- local save state;
- cloud sync state;
- active view;
- share;
- command search;
- account menu.

Rules:

- save and sync must be separate concepts;
- project title editing is inline but reversible;
- network failure must not present as local data loss;
- undo and redo show the action name in tooltip;
- destructive pending states must not be hidden inside menus.

### Left tool rail

Permanent categories:

- Select
- Draw
- Build
- Modify
- Annotate
- Measure
- View

Rules:

- maximum one expanded category at a time;
- active tool has an unmistakable state;
- tool order remains stable;
- labels appear on hover and keyboard focus;
- users can pin later, but the default remains controlled.

### Model panel

Contains:

- site;
- building;
- levels;
- views;
- sheets;
- schedules;
- imports;
- design options later;
- warnings.

Rules:

- selection in tree and canvas is coordinated;
- hidden objects remain discoverable;
- renaming never changes stable IDs;
- search works by display name, type, ID and selected properties.

### Canvas

Supports:

- plan;
- 3D;
- section later;
- elevation later;
- sheet.

Rules:

- canvas coordinates do not shift when panels open;
- focus remains clear;
- tool preview remains visible;
- canvas receives pointer events only when intended;
- browser gestures are suppressed only within the editor area and only when required.

### Right inspector

Groups:

- Identity
- Geometry
- Placement
- Type
- Instance
- Relationships
- Constraints
- Visibility
- Source
- Warnings
- History

Rules:

- inherited values show their source;
- overridden values show an override marker;
- calculated values are read-only unless a controlling parameter exists;
- bulk editing previews affected elements;
- invalid fields remain editable and explain the valid range.

### Bottom status bar

Contains:

- units;
- cursor coordinates;
- active snap;
- selection count;
- current level;
- view scale;
- model health;
- local journal state;
- sync state;
- performance warning when support mode is enabled.

### Context bar

Appears for the active tool or selection.

Rules:

- it never duplicates the whole inspector;
- it contains the most likely immediate controls;
- it remains keyboard reachable;
- it disappears after tool exit;
- it never covers critical model content without repositioning.

## 13. iPad shell

### Landscape

- compact top bar;
- floating left tool palette;
- right inspector drawer;
- bottom numeric and contextual strip;
- full-screen canvas toggle.

### Portrait

- canvas first;
- inspector as a resizable bottom sheet;
- tool palette collapses to categories;
- numeric entry remains visible above the software keyboard;
- no full desktop panel arrangement squeezed into portrait.

### Input roles

Apple Pencil:

- precise point selection;
- drawing;
- hover preview;
- handle manipulation;
- annotation;
- contextual tool action.

Finger:

- pan;
- pinch zoom;
- orbit;
- broad selection;
- interface controls.

Keyboard and trackpad:

- commands;
- numeric entry;
- shortcuts;
- precision selection;
- desktop-like navigation.

### Native-only opportunities

- squeeze on supported Apple Pencil Pro hardware;
- double tap;
- hover pose;
- haptic feedback;
- document browser;
- stronger offline storage;
- background processing;
- RoomPlan and ARKit access.

Web support must use capability detection. It must not assume native Pencil APIs.


# Part IV. Visual design system

## 14. Visual direction

Arq should look like a professional instrument.

It should be:

- monochromatic;
- calm;
- precise;
- compact without being cramped;
- legible for long sessions;
- visually consistent across desktop and iPad;
- distinct from generic SaaS dashboards;
- free from decorative gradients, glass effects and excessive rounded cards.

## 15. Appearance policy

**Locked for Release 1:** light appearance only.

Reason:

- one appearance reduces design and visual-regression scope;
- technical plans are conventionally clear on a light background;
- selection, printing and underlays can be tuned first;
- dark mode should not be shipped as an untested token inversion.

Dark mode becomes a separate milestone.

## 16. Typography

### Interface

Plus Jakarta Sans:

- 400 Regular;
- 500 Medium;
- 600 SemiBold;
- 700 Bold only for major headings.

### Technical values

JetBrains Mono:

- coordinates;
- dimensions;
- angles;
- units;
- IDs;
- command input;
- diagnostics;
- schema and file names.

### Tokens

| Token | Size | Line height | Weight |
|---|---:|---:|---:|
| `meta` | 11 px | 16 px | 500 |
| `caption` | 12 px | 16 px | 400 |
| `body` | 13 px | 18 px | 400 |
| `control` | 14 px | 20 px | 500 |
| `panel-title` | 16 px | 22 px | 600 |
| `dialog-title` | 20 px | 28 px | 600 |
| `page-title` | 28 px | 36 px | 600 |
| `numeric-small` | 12 px | 16 px | 500 mono |
| `numeric` | 14 px | 20 px | 500 mono |

Requirements:

- tabular numerals where available;
- no uppercase labels longer than short tags;
- units remain visually attached to values;
- minimum 12 px for persistent functional labels;
- browser zoom to 200% must preserve essential controls.

## 17. Colour tokens

| Token | Value | Use |
|---|---|---|
| `paper` | `#FFFFFF` | Primary panel and sheet |
| `surface-1` | `#FAFAFA` | App background |
| `surface-2` | `#F4F4F4` | Secondary controls |
| `surface-3` | `#ECECEC` | Selected neutral fill |
| `line-subtle` | `#E2E2E2` | Dividers |
| `line-default` | `#C7C7C7` | Inputs |
| `line-strong` | `#737373` | Strong boundaries |
| `text-muted` | `#737373` | Secondary information |
| `text-secondary` | `#555555` | Supporting text |
| `text-primary` | `#151515` | Primary text |
| `ink` | `#000000` | Critical contrast and active geometry |

Status may later use accessible accents, but no status may rely on hue alone.

## 18. State language

- Hover: subtle grey fill or dashed outline.
- Active tool: black icon container with white glyph, or strong border inversion.
- Primary selection: black outline, light neutral halo, white handles with black border.
- Secondary selection: dashed outline.
- Locked: lock icon plus diagonal pattern.
- Warning: triangle icon plus dotted underline or stripe.
- Blocking error: octagonal icon, cross-hatch and written label.
- Hidden: eye-off icon and reduced-opacity row.
- Imported: source badge and distinct line pattern.
- Proposed AI change: animated dash and “Proposed” label.
- Unsynced: cloud or sync icon plus written state.
- Recovered: recovery badge and explanation.

## 19. Spacing and shape

4-point base grid:

- 4 px micro;
- 8 px compact;
- 12 px control group;
- 16 px panel padding;
- 24 px section;
- 32 px major group;
- 48 px page.

Corners:

- buttons and inputs: 4 px;
- menus: 6 px;
- dialogs: 8 px;
- iPad floating palette: 10 px maximum;
- pills only for status and segmented controls.

Shadows:

- used only for floating layers;
- low opacity;
- no decorative elevation stack.

## 20. Icon system

### Generic icons

Lucide may be used temporarily for standard actions. Lucide is currently distributed under the ISC licence, with some Feather-derived icons retaining MIT terms. Include required notices.

### Technical icons

Create a custom Arq icon family.

Construction:

- 24 × 24 master grid;
- 20 × 20 compact test;
- 1.75 px stroke;
- round caps;
- round joins unless technical meaning requires a mitre;
- no baked colour;
- no filled icon except state inversion;
- optical centring;
- meaningful at 16 px;
- accessible name;
- default, hover, active, disabled and selected states.

First 40:

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
22. Plan
23. 3D
24. Orthographic
25. Perspective
26. Pan
27. Orbit
28. Fit
29. Section
30. Elevation
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

### Icon QA

- compare at 16, 20, 24 and 32 px;
- test 1x and high-density displays;
- test light background;
- test active inversion;
- remove duplicate metaphors;
- conduct recognition test with architects;
- never mix multiple production icon families.

## 21. Motion

- pointer feedback: immediate;
- button state: 80 to 120 ms;
- panel: 140 to 180 ms;
- dialog: 160 to 220 ms;
- camera transitions: interruptible;
- no decorative bounce;
- no mandatory animation for understanding;
- reduced motion respected;
- AI proposal animation must pause when generation is complete.


# Part V. Interaction system

## 22. Command lifecycle

Every tool uses the same lifecycle:

1. Idle
2. Armed
3. Previewing
4. Awaiting input
5. Validating
6. Committed
7. Failed safely
8. Cancelled

The active state must be visible in the context bar and exposed to accessibility APIs.

## 23. Escape rules

- First Escape clears an active field or handle.
- Second Escape cancels the current segment.
- Third Escape exits the tool.
- Escape while idle clears selection.
- Escape never deletes committed geometry.
- A long-running background task uses a separate Cancel control.

## 24. Enter rules

- Enter commits a valid preview.
- Invalid previews remain uncommitted.
- Error text identifies the exact problem.
- Enter never silently substitutes a different value.
- Repeated Enter may repeat the last safe command only when explicitly designed.

## 25. Selection

### Point selection

- click or Pencil tap selects the highest-priority eligible object;
- Tab cycles candidates;
- Shift toggles membership;
- inspector and model tree update together;
- selection remains stable while panning.

### Area selection

- left to right selects fully enclosed objects;
- right to left selects intersected objects;
- direction is shown visually;
- locked and hidden categories follow filter rules;
- count updates before release where performance allows.

### Priority

Default:

1. active handles;
2. annotation;
3. opening;
4. wall edge or body;
5. room;
6. underlay;
7. reference geometry.

Priority may change by tool.

### Selection bugs to prevent

- selecting an object behind a modal panel;
- losing selection during property edit;
- stale selection after delete;
- selected object not matching inspector;
- 2D and 3D highlighting different IDs;
- tiny objects becoming impossible to select;
- hidden objects receiving pointer hits;
- selection cycling changing when the camera is stationary.

## 26. Snapping

Snap engine is independent of renderer.

Each result includes:

```ts
interface SnapResult {
  point: Point2;
  type: SnapType;
  sourceElementId?: ElementId;
  sourceSubentity?: SubentityReference;
  priority: number;
  screenDistancePx: number;
  worldDistance: Length;
  suggestedConstraint?: ConstraintSuggestion;
}
```

Default priority:

1. endpoint;
2. intersection;
3. midpoint;
4. perpendicular;
5. centre;
6. tangent later;
7. grid;
8. extension;
9. nearest.

Requirements:

- glyph and label;
- configurable snap set;
- temporary override;
- snap lock;
- zoom-independent screen tolerance;
- deterministic tie-break;
- no jitter between two candidates;
- no snap to stale derived geometry;
- Pencil hover preview where supported.

## 27. Numeric entry

Typing during an active command opens a non-modal overlay.

Requirements:

- distance;
- angle;
- X and Y delta where relevant;
- unit suffix;
- negative values only where meaningful;
- decimal and fractional imperial input;
- locale-aware display, canonical internal value;
- Tab navigation;
- live preview;
- expression support later;
- history of recent values optional;
- invalid range explanation;
- overlay avoids cursor and geometry.

## 28. Coordinate systems

Support:

- world coordinates;
- project north;
- local object coordinates later;
- screen coordinates;
- sheet coordinates.

Rules:

- one canonical internal length unit;
- no floating display value becomes authoritative;
- transformations use double precision;
- large-coordinate projects receive origin management before IFC expansion;
- imported coordinate systems retain provenance.

## 29. Keyboard baseline

Examples:

- `V` Select
- `W` Wall
- `D` Door only if it does not conflict with Dimension
- `M` Move
- `R` Rotate
- `O` Offset
- `TR` Trim through command sequence or command palette
- `Esc` cancel
- `Enter` confirm
- `Space` temporary pan
- `Tab` cycle candidates or fields
- `Cmd/Ctrl+Z` undo
- `Cmd/Ctrl+Shift+Z` redo
- `Cmd/Ctrl+K` command palette
- `F` fit selection
- `Shift+F` fit project

Final shortcuts must be tested with architects and checked against browser and operating-system conflicts.

## 30. Command palette

Searches:

- commands;
- views;
- sheets;
- objects;
- settings;
- help;
- recent actions;
- selected properties;
- AI actions later.

Requirements:

- synonyms;
- fuzzy search;
- keyboard-first;
- result category;
- disabled reason;
- recent commands;
- no-result telemetry without recording project content;
- accessible active-descendant handling;
- fast open under 100 ms target.


# Part VI. Semantic building model

## 31. Internal model principles

- IFC is an exchange schema, not Arq’s live internal model.
- Three.js objects are rendering artefacts, not model objects.
- DXF entities are imports, not native architectural semantics.
- Stable IDs survive ordinary edits.
- Type and instance are explicit.
- Derived data is disposable.
- Relationships are queryable.
- Every imported element records provenance.
- Every schema version has a migration path.

## 32. Core entities

- Workspace
- User
- Team
- Project
- Site
- Building
- Level
- Grid
- Element
- ElementType
- Wall
- Opening
- Door
- Window
- Slab
- Room
- View
- Sheet
- Annotation
- Dimension
- ImportSource
- ExportRecord
- Operation
- Snapshot
- Revision
- Comment
- Issue
- Role
- DesignOption later
- Material later
- ComponentDefinition later

## 33. IDs

Use UUIDv7 or another time-sortable UUID implementation after library and interoperability review.

Rules:

- IDs are opaque;
- display names are not IDs;
- external IFC GlobalIds remain separate;
- imported DXF handles remain separate;
- deleted IDs are never reused;
- derived render objects carry source element ID;
- subentity references use stable semantic references where possible.

## 34. Units

Canonical storage recommendation:

- length in metres as double precision, or integer micrometres after profiling and overflow analysis;
- angle in radians;
- area in square metres;
- volume in cubic metres.

Decision requires ADR because numeric representation affects all geometry.

Display supports:

- millimetres;
- centimetres where selected;
- metres;
- decimal feet;
- feet and fractional inches.

Requirements:

- typed units;
- no naked numbers in core APIs;
- conversion tests;
- rounding independent from stored value;
- user precision settings;
- export precision report.

## 35. Type and instance

Every property state is:

- inherited;
- overridden;
- calculated;
- imported;
- missing;
- invalid.

Inspector behaviour:

- show source type;
- reset override;
- promote repeated overrides into a new type with preview;
- bulk edit with affected count;
- prevent cyclic inheritance;
- version reusable definitions later.

## 36. Derived dependency graph

A wall move may invalidate:

- wall outline;
- wall joins;
- hosted opening positions;
- room boundary graph;
- room areas;
- dimensions;
- plan render cache;
- 3D mesh;
- sheet viewport;
- validation results.

Do not rebuild the full project by default.

Each operation returns an invalidation set.

## 37. Base schema examples

```ts
interface Project {
  id: ProjectId;
  schemaVersion: number;
  name: string;
  unitSettings: UnitSettings;
  precision: PrecisionSettings;
  levelIds: LevelId[];
  elementIds: ElementId[];
  viewIds: ViewId[];
  sheetIds: SheetId[];
  revision: number;
}

interface Level {
  id: LevelId;
  name: string;
  elevation: Length;
  storeyHeight?: Length;
}

interface WallType {
  id: WallTypeId;
  name: string;
  thickness: Length;
  defaultHeight: Length;
  function: "exterior" | "interior" | "unknown";
}

interface Wall {
  id: WallId;
  typeId: WallTypeId;
  levelId: LevelId;
  start: Point2;
  end: Point2;
  alignment: "centre" | "interior" | "exterior";
  heightOverride?: Length;
  joinStart: WallJoinIntent;
  joinEnd: WallJoinIntent;
  hostedOpeningIds: OpeningId[];
}

interface Opening {
  id: OpeningId;
  hostWallId: WallId;
  kind: "door" | "window" | "void";
  offsetFromWallStart: Length;
  width: Length;
  sillHeight: Length;
  height: Length;
}

interface Room {
  id: RoomId;
  levelId: LevelId;
  seedPoint: Point2;
  name: string;
  number?: string;
  boundaryElementIds: ElementId[];
  calculatedBoundary: Polygon2;
  calculatedArea: Area;
  status: "valid" | "not-enclosed" | "overlapping" | "invalid";
}
```


# Part VII. Geometry engine

## 38. Geometry strategy

### Locked

The first wall and room system is purpose-built planar geometry.

### Recommended

Use exact-solid or B-rep technology only behind a replaceable adapter.

### Reason

Simple architectural walls do not require a full general-purpose CAD kernel for their initial authoritative representation. Starting with OpenCascade for every operation would add:

- large WebAssembly payload;
- worker initialisation time;
- difficult object lifetimes;
- kernel-specific failures;
- debugging complexity;
- licensing obligations;
- unnecessary coupling.

## 39. Geometry packages

### `geometry-2d`

Responsibilities:

- points;
- vectors;
- lines;
- rays;
- segments;
- arcs later;
- boxes;
- polygons;
- transforms;
- robust predicates;
- offsets;
- intersections;
- nearest point;
- point-in-polygon;
- triangulation;
- spatial index interfaces;
- tolerance policy.

### `geometry-3d`

Responsibilities:

- points;
- vectors;
- planes;
- transforms;
- boxes;
- generated wall mesh;
- slab mesh;
- opening subtraction for supported primitives;
- triangulation;
- normals;
- mesh validation;
- render-level geometry only until exact solids are introduced.

### `geometry-occt`

Optional adapter:

- STEP;
- B-rep booleans;
- complex solids;
- selected generic components;
- advanced intersections.

No core package may import OpenCascade-specific classes.

## 40. Tolerance policy

Define named tolerances:

- `coordinateEpsilon`
- `angularEpsilon`
- `coincidentPointTolerance`
- `minimumWallLength`
- `minimumOpeningClearance`
- `roomClosureTolerance`
- `snapScreenTolerance`

Rules:

- tolerance is explicit at API boundaries;
- no random `1e-6` values in feature code;
- equality functions state whether they are exact or tolerant;
- import tolerance may differ from native-authoring tolerance;
- exports record precision;
- regression files cover near-degenerate cases.

## 41. Candidate open-source geometry tools

### `robust-predicates`

Potential role:

- orientation tests;
- robust geometric decisions.

Treatment:

- spike and licence scan;
- wrap behind an Arq interface;
- include adversarial tests.

### `polygon-clipping` or Clipper2-derived implementation

Potential role:

- polygon union;
- intersection;
- difference;
- offset support.

Treatment:

- benchmark degeneracies;
- verify licence;
- do not expose library-specific structures to model packages.

### `earcut`

Potential role:

- polygon triangulation for display meshes.

Treatment:

- display geometry only;
- verify triangulation deviation;
- never use triangulation as authoritative room boundary.

### `RBush`

Potential role:

- spatial indexing;
- selection candidates;
- viewport culling;
- snap candidate filtering.

Treatment:

- index bounding boxes;
- rebuild or update deterministically;
- do not assume index results are exact geometry hits.

### `KittyCAD/ezpz`

MIT-licensed Rust geometric constraint solver with a WASM wrapper.

Potential role:

- later sketch constraint solving;
- benchmarking;
- horizontal, vertical, coincidence and dimensional constraints.

Treatment:

- spike only;
- initial wall tool uses simpler direct constraints;
- no dependency until diagnostics, WASM interface and performance are evaluated.

## 42. Geometry bugs to test

- nearly coincident endpoints;
- zero-length segments;
- reversed segment order;
- wall crossing at tiny angles;
- T join within tolerance;
- four-way join;
- overlapping collinear walls;
- duplicated wall;
- opening touching wall end;
- two openings touching;
- room with tiny gap;
- room with self-intersection;
- room containing island;
- large world coordinates;
- values near zero;
- extremely thin wall;
- negative dimensions;
- imported polyline with duplicate points;
- non-finite values;
- transform round-trip drift.


# Part VIII. Architectural components

## 43. Levels

Properties:

- ID;
- name;
- elevation;
- storey height;
- order;
- visibility;
- associated views.

Actions:

- create;
- rename;
- reorder;
- change elevation;
- duplicate view;
- delete with dependency report.

Delete must show:

- walls;
- rooms;
- views;
- dimensions;
- imports;
- affected sheets.

No dependent content may disappear silently.

## 44. Grids

Release 1 may defer full grids if interviews show low need for small residential work.

When added:

- named axes;
- line or arc later;
- extents;
- bubbles;
- visibility by view;
- snap;
- dimension references;
- stable identity.

## 45. Wall system

### Authoritative definition

- reference line;
- type;
- thickness;
- level;
- height;
- alignment;
- endpoint join intent;
- hosted openings.

### First wall tool

1. choose type;
2. choose alignment;
3. place start;
4. preview;
5. type distance or place end;
6. continue chain or finish;
7. preview joins;
8. validate;
9. commit.

### Wall joins

Initial:

- butt;
- mitre;
- T;
- cross;
- disallow join.

Later:

- material layer priority;
- complex compound layers;
- cleanup by function.

### Failure messages

Examples:

- “This wall is shorter than the supported minimum.”
- “These walls overlap on the same line. Trim one wall or merge them.”
- “The join cannot be resolved at this angle. Keep the walls unjoined or move an endpoint.”
- “Moving this endpoint would place a door outside its host wall.”

### Known wall bugs to prevent

- unexpected flipping when reversing endpoints;
- room boundary changes after visual-only alignment;
- hosted openings moving to the wrong end;
- joins changing after reopen;
- tiny slivers at T joins;
- plan and 3D disagreement;
- dimensions referencing a derived edge that is regenerated;
- stale room areas after thickness edit.

## 46. Doors

Properties:

- type;
- width;
- height;
- host;
- offset;
- side;
- hand;
- swing angle for display;
- sill normally zero;
- level;
- mark later.

Interactions:

- host preview;
- offset dimension;
- flip side;
- flip hand;
- resize;
- move along host;
- rehost through explicit command;
- invalid placement explanation.

Door geometry must be schematic first. Manufacturer detail is later.

## 47. Windows

Properties:

- type;
- width;
- height;
- sill;
- host;
- offset;
- side;
- level;
- mark later.

Interactions match doors where meaningful.

## 48. Openings

Doors and windows create hosted openings.

Rules:

- opening cannot exceed host height;
- opening cannot extend beyond host;
- overlaps are blocking by default;
- deleting host requires explicit treatment of openings;
- moving host preserves relative placement when valid;
- wall split assigns openings deterministically or asks the user.

## 49. Rooms

### First workflow

- click within enclosed boundary;
- calculate polygon;
- show preview;
- assign name;
- calculate area;
- display room label.

### Boundary sources

- room-bounding wall faces;
- explicit separation line later;
- selected openings follow room-boundary policy.

### Status

- valid;
- not enclosed;
- overlapping;
- too small;
- invalid polygon;
- stale while recomputing.

### Room error UX

Show:

- boundary highlight;
- nearest gap;
- distance of gap;
- suggested wall endpoint;
- “Zoom to gap” action;
- unchanged room identity where repair succeeds.

## 50. Slabs and floors

Recommended after wall-room slice:

- footprint polygon;
- level;
- offset;
- thickness;
- type;
- openings later.

Initial floor may be generated from selected room or boundary.

## 51. Stairs

Deferred.

Reason:

Stairs combine geometry, code conventions, annotation, levels, railings and many edge cases. A weak stair tool would recreate a major incumbent frustration.

Before implementation:

- interview stair workflows;
- define supported stair types;
- build rule engine;
- separate geometry from code checks;
- provide manual override;
- never claim code compliance.

## 52. Roofs

Deferred until wall and slab systems are stable.

First possible type:

- roof by footprint;
- constant pitch;
- selected edges define slope;
- simple hips and gables;
- transparent failure diagnostics.

## 53. Components and families

Deferred general editor.

First component approach:

- curated parameterised door and window types;
- generic fixed component with dimensions;
- versioned definition;
- explicit type and instance properties;
- no arbitrary executable code inside project files.

## 54. Materials

Deferred editing, but data model should reserve:

- name;
- visual properties;
- cut pattern;
- surface pattern;
- physical metadata later;
- source.

Release 1 may use neutral default materials.


# Part IX. Documentation system

## 55. Dimensions

### Linear dimension

References:

- wall reference line;
- wall face;
- opening centre;
- opening edge;
- explicit point;
- grid later.

Properties:

- witness lines;
- offset;
- text position;
- style;
- precision;
- prefix and suffix;
- override, visibly marked.

Rules:

- dimensions reference semantic subentities;
- detached references show warning;
- geometry change updates value;
- text override never changes measured value;
- print scale preserves legibility;
- numerical display follows project units.

### Later

- aligned;
- angular;
- radial;
- diameter;
- chain;
- baseline;
- equality.

## 56. Text notes

- plain text;
- controlled styles;
- alignment;
- width;
- leader later;
- no rich-text complexity initially;
- font embedding strategy for PDF;
- missing glyph fallback;
- copied text sanitised.

## 57. Tags

Deferred until schedules and stable properties.

Tag requirements:

- semantic property reference;
- orphan warning;
- type-based style;
- collision management later;
- leader;
- bulk placement.

## 58. Sheets

First sheet:

- standard size;
- custom size;
- title;
- number;
- project metadata;
- one plan viewport;
- scale;
- revision;
- export.

Later:

- multiple viewports;
- schedules;
- title block templates;
- issue status;
- approval roles.

## 59. PDF export

### Requirement

Vector linework, not a canvas screenshot.

### Candidate

`pdf-lib` is MIT-licensed and can create and modify PDF documents and draw vector content.

### Limitations to design around

- text wrapping must be implemented;
- advanced print-production features may require custom work;
- font embedding must be tested;
- line joins and patterns must be validated;
- huge drawings must not exhaust memory.

### Export pipeline

1. freeze export snapshot;
2. validate sheet;
3. resolve fonts;
4. generate vector primitives;
5. add metadata;
6. write PDF;
7. validate page count and bounds;
8. store export record;
9. return download;
10. never modify project state.

### PDF regression

- Acrobat or another independent reader;
- browser PDF viewer;
- macOS Preview;
- printed scale test;
- font extraction;
- line weight comparison;
- no clipped notes;
- no rasterised primary plan.


# Part X. Rendering

## 60. Rendering architecture

Maintain a renderer-neutral scene description.

The model produces:

- plan primitives;
- annotation primitives;
- 3D mesh instances;
- visibility state;
- selection state;
- style tokens.

Renderers consume these structures.

## 61. 2D renderer decision

### Options

#### Canvas 2D

Pros:

- simple;
- mature;
- good text;
- low initial complexity.

Cons:

- CPU-bound;
- manual retained scene;
- harder large-scene performance;
- manual hit testing.

#### SVG

Pros:

- vector;
- DOM accessibility;
- easy debugging.

Cons:

- large DOM;
- performance limits;
- difficult dense interactive scenes.

#### PixiJS

Pros:

- MIT;
- WebGL and WebGPU backends;
- high-performance retained display;
- interaction utilities.

Cons:

- not a CAD engine;
- technical line quality requires work;
- recent WebGPU issues require caution;
- vector export still needs a separate pipeline.

#### CanvasKit

Pros:

- Skia quality;
- strong 2D drawing;
- WASM;
- technical rendering potential.

Cons:

- larger payload;
- manual integration;
- text and resource lifecycle complexity.

### Recommendation

Build a renderer abstraction and spike:

1. Canvas 2D;
2. PixiJS WebGL;
3. CanvasKit if the first two fail protected tests.

Likely first production choice:

- PixiJS or a custom WebGL renderer for interaction;
- independent vector scene for PDF;
- WebGL backend by default;
- WebGPU optional after benchmark.

## 62. 3D renderer

### Recommendation

Three.js with WebGL as the stable first backend.

WebGPU:

- capability detected;
- experimental or opt-in initially;
- benchmarked separately;
- no feature may exist only in WebGPU during Release 1.

Reason:

Three.js supports both WebGL and WebGPU paths, but current renderer changes and platform issues make a WebGPU-only professional editor unnecessarily risky.

### First 3D features

- orthographic camera;
- orbit;
- pan;
- zoom;
- fit selection;
- fit project;
- selection outline;
- hide;
- isolate;
- section box later;
- neutral ambient and directional lighting;
- simple floor;
- wall and opening meshes;
- no photorealism.

## 63. Model rendering separation

Prohibited:

- storing Three.js object references inside BIM entities;
- using mesh UUID as element ID;
- serialising renderer state as project semantics;
- applying property changes directly to scene objects without an operation.

## 64. Large model strategy

- scene chunks by level and spatial tile;
- instancing for repeated components;
- frustum culling;
- level of detail;
- screen-space simplification;
- bounding boxes while dragging;
- delayed hidden-view update;
- unload inactive imported fragments;
- background mesh generation;
- content-hash cache;
- memory pressure warning;
- graceful reduction before crash.

## 65. Split view

- plan and 3D side by side;
- same selection IDs;
- inactive view throttled;
- no forced camera motion;
- explicit “Focus selection” command;
- shared operation history;
- independent view undo only for camera if required.


# Part XI. State, operations, undo and recovery

## 66. State boundaries

### UI state

- panel sizes;
- active mode;
- active tool;
- hover;
- menus;
- temporary preview;
- camera.

### Project state

- semantic entities;
- views;
- sheets;
- annotations;
- imports;
- operation revision.

### Derived state

- room boundaries;
- meshes;
- render lists;
- spatial indexes;
- validation results;
- thumbnails.

Do not put the full project model inside React component state.

## 67. Operation contract

```ts
interface ModelOperation<TPayload, TResult> {
  id: OperationId;
  type: OperationType;
  actorId: UserId;
  projectId: ProjectId;
  baseRevision: number;
  timestamp: string;
  payload: TPayload;
  preconditions: OperationPrecondition[];
}

interface OperationResult<TResult> {
  status: "applied" | "rejected";
  result?: TResult;
  affectedElementIds: ElementId[];
  invalidations: DerivedInvalidation[];
  validationMessages: ValidationMessage[];
  inverse?: SerialisedOperation;
  durationMs: number;
}
```

Operations are data, not executable closures in stored files.

## 68. Initial operations

- CreateProject
- RenameProject
- CreateLevel
- UpdateLevel
- DeleteLevel
- CreateWall
- UpdateWall
- MoveWall
- SplitWall
- JoinWalls
- DeleteWall
- CreateOpening
- UpdateOpening
- MoveOpening
- DeleteOpening
- CreateRoom
- UpdateRoom
- CreateDimension
- UpdateDimension
- DeleteElement
- ImportUnderlay
- CalibrateUnderlay
- CreateView
- UpdateView
- CreateSheet
- ApplyAIProposal later

## 69. Undo

Rules:

- every committed user edit declares inverse behaviour;
- grouped command becomes one user-facing undo;
- derived recalculation is not a separate undo item;
- import is one transaction;
- failed operation is not added;
- camera history is separate from model undo;
- collaborative undo affects eligible user operations only;
- restoring a snapshot creates a new revision.

## 70. Local persistence

### Recommendation

Dexie on IndexedDB for Release 1.

Reason:

- established browser persistence wrapper;
- supports structured data;
- suitable for PWA and browser applications;
- simpler than deploying SQLite WASM immediately.

### SQLite WASM

Spike later for:

- larger local datasets;
- advanced queries;
- desktop shell;
- stronger transactional model.

Constraints:

- OPFS worker requirements;
- cross-origin isolation headers for some configurations;
- API churn must be tracked;
- no need before IndexedDB limits are measured.

### PGlite

Reference only initially.

It provides Postgres in WASM but introduces a database model larger than the initial browser editor requires. Its single-user, single-connection nature and payload must be assessed before any use.

## 71. Journal and snapshots

Write order:

1. validate operation;
2. apply to in-memory copy or transaction;
3. write journal;
4. publish committed state;
5. schedule snapshot and sync.

Snapshot policy:

- operation count threshold;
- elapsed time;
- before migration;
- before major import;
- before AI proposal later;
- user-named revision.

## 72. Recovery

Recovery screen shows:

- project;
- last committed time;
- recovered operation count;
- any incomplete operation;
- safe-mode option;
- duplicate-before-open option;
- technical report export.

Derived caches may be discarded and regenerated.

## 73. `.arq` format v0

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

Use JSON first.

Requirements:

- schema version;
- application version;
- project ID;
- creation time;
- checksums;
- deterministic ordering where practical;
- no cloud-only requirement;
- migration report;
- unknown optional sections ignored safely;
- corrupted optional cache does not prevent opening;
- zip-bomb and path-traversal protection.

## 74. Migrations

Each migration has:

- source version;
- target version;
- pure transformation where possible;
- backup;
- validation;
- test fixture;
- failure message;
- rollback or original archive retention.

Never overwrite the only copy during migration.


# Part XII. Backend and cloud architecture

## 75. Deployment shape

Start with a modular monolith.

Deployables:

1. web editor;
2. marketing and documentation site;
3. API;
4. asynchronous worker only when required.

Do not begin with separate geometry, collaboration, export, thumbnail and AI microservices.

## 76. Monorepo

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
│   ├── geometry-occt/
│   ├── bim-core/
│   ├── operations/
│   ├── project-format/
│   ├── local-storage/
│   ├── validation/
│   ├── pdf-export/
│   ├── dxf-adapter/
│   ├── ifc-adapter/
│   ├── collaboration/
│   ├── telemetry/
│   └── test-models/
├── workers/
│   ├── geometry-worker/
│   └── import-export-worker/
├── docs/
├── benchmarks/
├── scripts/
└── .github/
```

Recommended tooling:

- TypeScript strict mode;
- pnpm workspaces;
- Turborepo or equivalent task orchestration;
- React for shell;
- Vite for editor;
- current supported Node runtime;
- PostgreSQL;
- S3-compatible object storage.

Versions should be pinned through lockfiles and update automation, not hard-coded in this document.

## 77. API responsibilities

- authentication session;
- workspace;
- project metadata;
- permissions;
- snapshot upload;
- snapshot download;
- operation sync;
- export job;
- import job later;
- comments;
- issues;
- audit events;
- billing later.

## 78. Authentication options

### Recommended for early product

Use a well-reviewed OIDC-compatible authentication layer or a maintained TypeScript authentication framework after a security spike.

Candidates:

- Auth.js;
- Better Auth;
- managed provider if operational capacity is limited.

### Enterprise later

Keycloak is Apache-2.0 open-source identity and access management, but it adds operational complexity. Consider it only when enterprise SSO, self-hosting or advanced federation becomes a real requirement.

Requirements regardless of provider:

- passkeys later;
- secure session cookies;
- CSRF protection;
- rate limits;
- email verification;
- account recovery;
- session revocation;
- audit events;
- organisation membership;
- no authentication logic inside geometry packages.

## 79. Permissions

Roles:

- Owner
- Administrator
- Editor
- Commenter
- Viewer

Actions checked server-side:

- view;
- download archive;
- export;
- edit;
- invite;
- remove member;
- change role;
- issue revision;
- delete project;
- restore archive.

Viewer access must not rely only on hidden interface controls.

## 80. Object storage

Store:

- project snapshots;
- `.arq` archives;
- imports;
- exports;
- thumbnails;
- crash-support bundles where user consents.

Use:

- signed URLs;
- content type checks;
- size limits;
- malware scanning where appropriate;
- checksums;
- retention policies;
- tenant-scoped paths.

## 81. Background jobs

Only use when needed:

- PDF export beyond browser limits;
- IFC import;
- IFC export;
- thumbnails;
- large archive validation.

Requirements:

- idempotency key;
- progress stages;
- cancellation;
- retry policy;
- dead-letter handling;
- no duplicate project mutation;
- user-visible failure reason.


# Part XIII. Collaboration

## 82. Collaboration sequence

### Stage 1

- share link;
- viewer;
- commenter;
- comments;
- issues;
- presence;
- revision comparison;
- no simultaneous geometry edits required.

### Stage 2

- controlled editor lease or element lock;
- clear ownership;
- operation sync;
- conflict warning.

### Stage 3

- concurrent geometry operations where safe;
- server preconditions;
- branch or design option for major alternatives;
- no silent destructive merge.

## 83. Candidate technologies

### Yjs

Good candidate for:

- presence;
- comments;
- rich text;
- lightweight shared metadata.

Do not store the entire B-rep or building model as a naïve Yjs document.

### Automerge

MIT-licensed local-first CRDT with Rust and WASM.

Alternative for:

- local-first metadata;
- selected structured documents.

Spike only. Choose one collaboration foundation, not both.

### Hocuspocus or y-sweet

Possible Yjs backend infrastructure.

Evaluate:

- persistence;
- awareness;
- scaling;
- authentication;
- operational burden;
- licence;
- offline recovery.

## 84. Geometry conflict model

Each operation includes:

- base project revision;
- affected IDs;
- expected property versions;
- preconditions.

Conflict outcomes:

- apply;
- rebase automatically for independent changes;
- reject with explanation;
- create design option;
- ask user to choose.

Never resolve by last-write-wins for:

- delete versus modify;
- two moves of same wall;
- host deletion;
- opening overlap;
- level deletion;
- conflicting type edits.

## 85. Presence

Show:

- participant initials;
- active view;
- selection where permitted;
- cursor in same view;
- idle state;
- offline state.

Default monochrome may use:

- initials;
- line patterns;
- badges.

Optional accessible colour accents can be enabled later.


# Part XIV. Interoperability

## 86. General import rule

Every import produces a report with:

- source file;
- detected format;
- version;
- units;
- coordinate system if available;
- preserved objects;
- converted objects;
- simplified objects;
- unsupported objects;
- failed objects;
- warnings;
- source identifiers;
- timing;
- generated elements.

Import occurs in a temporary transaction.

## 87. General export rule

Every export produces:

- format;
- version;
- support matrix reference;
- included categories;
- omitted categories;
- warnings;
- validation result;
- project revision;
- checksum;
- export time.

## 88. Image underlay

Support:

- PNG;
- JPEG;
- WebP where browser decoding is reliable.

Features:

- placement;
- rotation;
- scale;
- opacity;
- lock;
- crop later;
- calibration by two points and known distance;
- visible “uncalibrated” status.

Never present traced dimensions as accurate until calibrated.

## 89. PDF underlay

First support:

- page selection;
- raster preview;
- scale calibration;
- lock;
- opacity.

Vector extraction is later and must distinguish imported source lines from native geometry.

## 90. DXF

### Candidates

- `dxfjs/parser`;
- `dxf-parser-writer`;
- `ezdxf` server-side for richer processing.

### Strategy

Stage 1:

- lines;
- lightweight polylines;
- arcs;
- circles;
- text;
- layers;
- units;
- blocks as imported groups where possible.

Stage 2:

- dimensions;
- hatches;
- richer block handling;
- styles.

Report unsupported entities.

Do not promise DWG because DXF works.

## 91. DWG

Direct open-source options are legally and technically difficult.

- LibreDWG is GPL-3.0.
- libdxfrw is GPL-2.0.
- modern DWG writing has format and reliability limitations.
- QCAD uses a proprietary plugin for optional DWG.

Recommendation:

- no native DWG promise initially;
- accept DXF;
- evaluate a commercial ODA-based service or licensed SDK only after customer evidence;
- keep conversion isolated;
- clearly label converted files.

## 92. IFC

### Standard

The current official IFC release is IFC 4.3.2.0, published as ISO 16739-1:2024.

Arq should support only published subsets and versions it tests.

### Browser candidate

`ThatOpen/engine_web-ifc`:

- reads and writes IFC;
- browser and Node support;
- WASM;
- MPL-2.0.

Use behind `ifc-adapter`.

### Server candidate

IfcOpenShell:

- broad IFC parsing and geometry;
- LGPL-3.0;
- mature openBIM ecosystem.

Use only after licence and deployment review.

### Components

That Open’s old `web-ifc-viewer` is deprecated in favour of its Components stack. Do not start a new product on the deprecated viewer.

### IFC stages

1. View and inspect.
2. Import selected semantics.
3. Export selected native entities.
4. Round-trip benchmarks.

### First mapped categories

- IfcProject
- IfcSite
- IfcBuilding
- IfcBuildingStorey
- IfcWall or IfcWallStandardCase where appropriate
- IfcDoor
- IfcWindow
- IfcSlab
- IfcSpace

### Validation

- buildingSMART sample files;
- IFC2x3 reference files where market requires;
- IFC4;
- IFC4.3 selected tests;
- independent viewers;
- source GlobalId retention;
- geometry and property report.

### Claims prohibited

- “lossless IFC” without benchmark evidence;
- “full IFC support”;
- “Revit compatible” based only on opening one file.

## 93. IDS and bSDD

Later:

- Information Delivery Specification validation;
- buildingSMART Data Dictionary property references.

Do not copy buildingSMART documentation text into product documentation without respecting its licence.

## 94. BCF

Later review workflow:

- issues;
- viewpoints;
- snapshots;
- element references;
- status.

A good candidate after comments and IFC viewing.

## 95. glTF and GLB

Use for visual exchange:

- compact viewer model;
- presentations;
- external rendering;
- thumbnails.

Do not use glTF as the authoritative BIM format.

## 96. STEP

Use only for:

- selected generic solids;
- component exchange;
- later fabrication or product geometry.

Not the primary building exchange format.


# Part XV. AI and ArqScript

## 97. AI principle

AI does not directly mutate hidden geometry.

Workflow:

1. user request;
2. intent extraction;
3. assumptions;
4. structured operation plan;
5. semantic validation;
6. geometry validation;
7. visual preview;
8. written change list;
9. user apply or reject;
10. grouped history;
11. undo.

## 98. ArqScript

Human-readable, versioned, unit-aware and deterministic.

Example:

```arq
version "0.1"

level "Ground Floor" elevation 0mm

wall "W1" {
  from: point(0mm, 0mm)
  to: point(6000mm, 0mm)
  type: "Exterior 230"
  height: 3000mm
}

door "D1" {
  host: "W1"
  width: 900mm
  height: 2100mm
  offset: 1200mm
}
```

ArqScript is:

- an interchange and operation language;
- not the only project representation;
- schema validated;
- parsed without arbitrary code execution;
- safe to diff;
- suitable for benchmarks.

## 99. ArqScript v0 commands

- define units;
- create level;
- create wall;
- update wall;
- place door;
- place window;
- create room;
- add dimension;
- select by ID;
- select by category;
- rename.

## 100. First user-facing AI

### Feature 1: Explain selection

Explain:

- what object it is;
- inherited properties;
- overrides;
- host;
- room relationships;
- warnings;
- effect of changing a property.

### Feature 2: Bounded modification

Examples:

- “Change the selected walls to 150 mm.”
- “Move this door 300 mm left.”
- “Rename these rooms from the selected list.”
- “Add dimensions to this wall chain.”

## 101. AI proposal panel

Shows:

- original request;
- parsed intent;
- assumptions;
- exact elements;
- exact operations;
- before and after values;
- warnings;
- preview;
- Apply;
- Edit request;
- Reject.

## 102. Guardrails

- never claim code approval;
- never claim structural safety;
- never hide assumptions;
- never delete to make a request succeed without showing deletion;
- never infer scale from image without calibration;
- never train on private projects by default;
- never execute arbitrary project code;
- never bypass permissions;
- never apply while validation is blocking;
- retain prompt and operation audit according to privacy settings.

## 103. Evaluation

Categories:

- text to wall;
- modify wall;
- place opening;
- room adjacency;
- constraint satisfaction;
- ambiguous request;
- invalid request;
- multi-step revision;
- error explanation;
- schedule generation.

Metrics:

- dimensional accuracy;
- semantic accuracy;
- valid geometry;
- assumptions;
- user corrections;
- time saved;
- operation latency;
- rejection quality;
- crash rate;
- undo success.

## 104. Open-source AI references

### `earthtojake/text-to-cad`

Adapt:

- task-specific skills;
- validation;
- preview;
- benchmark format;
- export checks.

Do not treat it as an architectural BIM model.

### GenCAD

Reference research only.

Its code, data and model licence must be confirmed independently. No reuse while unclear.

### OpenSCAD and JSCAD

Reference:

- deterministic script-to-geometry;
- reproducible compilation;
- parameterisation.

Do not embed GPL OpenSCAD into a proprietary core without legal review.


# Part XVI. Native platforms and capture

## 105. Web first

Benefits:

- Windows, macOS and iPad access;
- one editor shell;
- share links;
- collaboration;
- rapid fixes;
- WASM and Workers;
- installable PWA path.

Constraints:

- memory;
- file system;
- background work;
- browser shortcuts;
- offline quota;
- iPad browser limits.

Every constraint must be measured on supported devices.

## 106. WebGPU

Safari 26 introduced WebGPU across Apple platforms.

Policy:

- feature detection;
- WebGL fallback;
- WebGPU benchmark;
- no WebGPU-only authoring feature in Release 1;
- monitor W3C specification changes and browser defects.

## 107. PWA and local files

Use:

- service worker for application shell;
- offline project access after explicit local availability;
- Storage API persistence request where supported;
- OPFS only behind a storage adapter;
- clear storage quota and eviction warnings;
- archive download remains the ultimate user-controlled backup.

## 108. Native iPad

Add only after web editor proves model and interaction.

Native value:

- Apple Pencil hover;
- double tap;
- squeeze on supported Pencil Pro;
- haptic feedback;
- document browser;
- background tasks;
- stronger file storage;
- camera;
- RoomPlan;
- ARKit scene reconstruction.

## 109. LiDAR and RoomPlan

Apple RoomPlan can use camera and LiDAR to create room plans and identify architectural components such as walls, windows, openings and doors, with USD output.

Arq must not assume that RoomPlan output is a complete editable BIM model.

Required conversion pipeline:

1. capture;
2. confidence;
3. unit and coordinate check;
4. detect walls and openings;
5. simplify;
6. resolve intersections;
7. show uncertainty;
8. let user correct;
9. convert to Arq operations;
10. validate rooms;
11. retain source scan provenance.

Accuracy claims require device and environment testing. Do not call it survey-grade by default.

## 110. iPhone

First role:

- viewer;
- comments;
- measurements;
- site photos;
- issue capture;
- later scan capture.

Full authoring is not a priority.

## 111. macOS and Windows

After web editor:

- Tauri or another thin desktop shell spike;
- native file access;
- large local archives;
- background workers;
- offline mode;
- auto-update;
- native menus;
- crash reports.

Do not rewrite the complete interface natively without benchmark evidence.


# Part XVII. Open-source technology assessment

## 112. Classification policy

- **Adopt:** suitable after normal review.
- **Spike:** plausible but must be measured.
- **Reference:** study without core dependency.
- **Isolate:** usable only behind a legal and technical boundary.
- **Avoid:** unsuitable for the planned proprietary core or current stage.

## 113. Matrix

| Project | Role | Licence observed | Treatment | Notes |
|---|---|---:|---|---|
| Three.js | 3D rendering | MIT | Adopt | WebGL first, WebGPU optional |
| PixiJS | 2D GPU renderer | MIT | Spike | Useful, but technical line quality and WebGPU bugs require tests |
| CanvasKit | 2D WASM renderer | BSD-style Skia ecosystem | Spike | Strong quality, heavier integration |
| Fabric.js | Interactive Canvas | MIT | Reference | Useful prototype, not preferred CAD core |
| Konva | Canvas interaction | MIT | Reference | Useful interaction patterns |
| Paper.js | Vector geometry | MIT | Reference | Older release cadence, avoid core dependency without review |
| Lucide | Generic icons | ISC and inherited MIT files | Adopt temporarily | Custom technical icons remain Arq-owned |
| React Aria Components | Accessible UI | Apache-2.0 | Spike to adopt | Preferred accessibility foundation |
| Radix Primitives | Accessible UI | MIT | Alternative | Do not mix complete primitive systems |
| Floating UI | Overlay positioning | MIT | Adopt | Popovers and tooltips |
| Dexie | IndexedDB | Apache-2.0 | Adopt | First local store |
| SQLite WASM | Local SQL | Apache-2.0 | Spike later | OPFS and Worker constraints |
| PGlite | Browser Postgres | Apache-2.0 and PostgreSQL | Reference | Not needed initially |
| Yjs | CRDT | MIT | Spike | Presence and comments |
| Automerge | CRDT | MIT | Alternative | Choose one collaboration base |
| Hocuspocus | Yjs backend | MIT | Spike later | Collaboration service option |
| OpenCascade.js | Exact CAD kernel | LGPL-2.1 | Isolate and spike | Do not make core model kernel-specific |
| RepliCAD | Browser code CAD | MIT | Reference or spike | Higher-level OpenCascade abstraction |
| FreeCAD | Parametric CAD | LGPL-2.1 | Reference | Object model, transactions, OpenCascade lessons |
| OpenSCAD | Script CAD | GPL-2.0 | Reference | ArqScript lessons, avoid direct proprietary integration |
| JSCAD | Browser code CAD | MIT | Reference | Parametric workflow and CSG |
| LibreCAD | 2D CAD | GPL-2.0 | Reference | Drafting behaviour and DXF cases |
| QCAD community | 2D CAD | GPL-3.0 | Reference | Scripting and drafting behaviour |
| SolveSpace | Constraint CAD | GPL-3.0 | Reference | Constraint UX; web build described as experimental |
| KittyCAD/ezpz | Constraint solver | MIT | Spike | Rust and WASM, early project |
| CAD Sketcher | Constraint CAD in Blender | GPL-3.0 | Reference | Interaction research |
| text-to-cad | Agent CAD workflows | MIT | Reference and compatible patterns | Skills and benchmarks |
| GenCAD | Image-conditioned CAD research | unclear in inspected repo | Avoid reuse | Read paper only until licences confirmed |
| RevitLookup | BIM inspection | MIT | Reference and compatible patterns | Inspector and relationship navigation |
| web-ifc | IFC read/write | MPL-2.0 | Isolate and spike | Adapter and modification obligations |
| That Open Components | BIM viewer components | inspect current repo terms | Spike | Use current stack, not deprecated viewer |
| web-ifc-viewer | Old BIM viewer | deprecated | Avoid new dependency | Upstream directs users to Components |
| IfcOpenShell | IFC toolkit | LGPL-3.0 | Isolate server-side | Broad capability |
| Bonsai | BIM authoring in Blender | GPL-3.0 | Reference | Native IFC workflows |
| xeokit-sdk | BIM viewer | AGPL-3.0 or commercial | Avoid core unless licensed | Commercial option possible |
| Speckle | AEC data and connectors | mixed | Integrate later after component review | Do not assume whole platform is Apache |
| dxfjs/parser | DXF parser | MIT | Spike | Browser import |
| dxf-parser-writer | DXF parser/writer | MIT | Spike | Exchange prototype |
| ezdxf | DXF Python toolkit | MIT | Spike server-side | Rich DXF support |
| LibreDWG | DWG | GPL-3.0 | Avoid core | Modern write limitations |
| libdxfrw | DXF/DWG | GPL-2.0 | Avoid proprietary core | Reference only |
| pdf-lib | PDF | MIT | Adopt with tests | Vector output, text-layout work needed |
| Keycloak | IAM | Apache-2.0 | Later enterprise option | Operationally heavy |
| Auth.js | Authentication | Open source | Spike | Early product option |
| Better Auth | TypeScript auth | inspect current package terms | Spike | Useful organisations and providers |
| OpenTelemetry JS | Observability | Apache-2.0 | Adopt carefully | Browser support needs targeted testing |

## 114. Licence rules

- Every package has SPDX metadata.
- Generate SBOM.
- Block missing licences.
- Record code, dataset, model weights, fonts and icons separately.
- Preserve notices.
- Review transitive native and WASM components.
- Keep GPL and AGPL code out of proprietary core unless legal strategy changes.
- Keep MPL modifications isolated and publish required modified files.
- Follow LGPL relinking and notice obligations after legal review.
- No source, weights or datasets from an unclear licence.
- Review every Speckle directory or package used.
- Do not copy competitor UI, icons, documentation or brand assets.
- Legal review before commercial distribution.


# Part XVIII. Security and privacy

## 115. Threat model

Assets:

- private building designs;
- addresses;
- client information;
- exports;
- access tokens;
- comments;
- audit records;
- AI prompts;
- imported files.

Threats:

- cross-tenant access;
- malicious IFC, DXF, SVG or archive;
- zip bomb;
- path traversal;
- parser memory exhaustion;
- denial of service through geometric complexity;
- prompt injection through imported text;
- account takeover;
- insecure share link;
- stale permission cache;
- client-side secret exposure;
- supply-chain dependency;
- malicious plugin later.

## 116. Controls

- tenant isolation;
- server-side authorisation;
- encrypted transport;
- encryption at rest;
- signed short-lived URLs;
- private by default;
- share-link expiry;
- optional password later;
- rate limits;
- file limits;
- complexity limits;
- parser sandbox;
- Workers or isolated process;
- fuzzing;
- dependency scan;
- secret scan;
- CSP;
- secure cookies;
- CSRF protection;
- audit events;
- deletion policy;
- backup policy;
- incident runbook.

## 117. AI privacy

- no training on private projects by default;
- provider and region disclosed;
- prompt retention control;
- project-content minimisation;
- selected context only;
- no silent sending of full project;
- audit of data sent;
- admin policy later;
- imported text treated as untrusted.

## 118. Analytics privacy

Do not collect by default:

- geometry;
- project names;
- addresses;
- raw prompts;
- sheet content;
- client names.

Collect:

- tool invoked;
- success or failure code;
- latency;
- crash;
- command search no result;
- recovery;
- export type;
- coarse model tier;
- opt-in diagnostics.

## 119. File fuzzing

Fuzz:

- `.arq`;
- IFC;
- DXF;
- SVG if supported;
- PDF metadata and underlay path;
- compressed archives.

Expected outcome:

- reject safely;
- bounded memory;
- no project mutation;
- diagnostic code;
- no executable content.


# Part XIX. Reliability, performance and observability

## 120. Performance budgets

Protected benchmark:

- 2 levels;
- 150 walls;
- 80 openings;
- 60 rooms;
- 200 annotations;
- 1 underlay;
- approximately 1,000 semantic objects.

Targets:

- local project interactive under 2 seconds after data is available;
- selection median under 50 ms;
- hover median under 32 ms;
- pan and zoom 60 fps target;
- 3D orbit 60 fps target on benchmark device;
- wall commit median under 100 ms;
- room recalculation median under 150 ms for one wall move;
- undo median under 150 ms;
- journal write under 100 ms;
- command palette open under 100 ms;
- PDF export under 5 seconds for benchmark project or visible staged progress.

These are design targets, not public claims until measured.

## 121. Supported device matrix

Define:

- minimum Mac;
- minimum Windows machine;
- supported iPad;
- browsers;
- memory;
- GPU;
- input devices.

Test real devices. Browser user-agent assumptions are insufficient.

## 122. Degradation

When pressure rises:

- simplify inactive geometry;
- hide fine edges while moving;
- throttle inactive view;
- unload unused levels;
- suspend thumbnails;
- use bounding boxes;
- postpone noncritical validation;
- show memory warning;
- preserve journal;
- offer server export;
- never discard committed work.

## 123. Reliability rules

- local journal before sync success;
- import in transaction;
- export read-only;
- cancel long tasks;
- idempotent jobs;
- derived cache replaceable;
- safe mode;
- recovery after abnormal termination;
- original archive retained during migration;
- support bundle excludes model content unless user chooses otherwise.

## 124. Observability

Use OpenTelemetry-compatible traces and metrics where supported.

Track:

- operation duration;
- worker queue;
- render frame time;
- memory estimate;
- import stage;
- export stage;
- sync latency;
- recovery events;
- error code;
- browser and device class.

Do not send raw project content in traces.

## 125. Error taxonomy

- `USER_INPUT`
- `MODEL_VALIDATION`
- `GEOMETRY`
- `IMPORT`
- `EXPORT`
- `STORAGE`
- `SYNC`
- `PERMISSION`
- `NETWORK`
- `MIGRATION`
- `RESOURCE_LIMIT`
- `INTERNAL`

Every error has:

- stable code;
- user title;
- explanation;
- affected elements;
- safe action;
- support detail;
- retry policy.


# Part XX. Accessibility

## 126. Baseline

- keyboard access to every command;
- visible focus;
- semantic headings;
- labelled controls;
- status not colour-only;
- reduced motion;
- touch targets at least 44 points on iPad;
- 200% browser zoom;
- clear error association;
- command palette announcements;
- menu and dialog focus management;
- no keyboard trap;
- high contrast.

## 127. Canvas accessibility

A technical canvas is difficult to expose completely.

Release 1 must still provide:

- model tree;
- selected object description;
- property inspector;
- keyboard commands;
- list of warnings;
- view navigation buttons;
- textual coordinate readout;
- command history.

Do not claim full screen-reader authoring until tested with users.

## 128. Accessibility QA

- automated checks;
- keyboard script;
- VoiceOver on macOS and iPad;
- NVDA on Windows;
- browser zoom;
- reduced motion;
- high contrast;
- external accessibility review before broad launch.


# Part XXI. Testing

## 129. Unit tests

- units;
- vectors;
- intersections;
- offsets;
- wall outline;
- joins;
- openings;
- room boundaries;
- areas;
- dimension references;
- operations;
- inverse operations;
- archive;
- checksums;
- migrations;
- permissions;
- import mappings.

## 130. Property-based tests

- operation then inverse restores state;
- serialisation preserves IDs;
- translation preserves area;
- endpoint reversal preserves physical wall;
- valid room remains non-self-intersecting;
- invalid number never commits;
- snapshot and journal replay match current state.

## 131. Golden models

1. Rectangular room
2. L room
3. Two shared rooms
4. Corridor
5. T junction
6. Cross junction
7. Door near end
8. Overlapping openings
9. Two-level house
10. Underlay
11. Tiny gap
12. Large coordinates
13. Reversed wall chain
14. Imported DXF
15. Imported IFC viewer case

## 132. Visual regression

- empty editor;
- wall preview;
- snap states;
- selected wall;
- selected door;
- invalid room;
- inspector inherited value;
- inspector override;
- split view;
- sheet;
- PDF preview;
- iPad landscape;
- portrait inspector;
- 200% zoom.

## 133. Interoperability tests

For each supported format:

1. import;
2. report;
3. inspect;
4. modify;
5. export;
6. reopen in Arq;
7. open independently;
8. compare geometry;
9. compare semantics;
10. store result.

## 134. Recovery tests

- terminate after commit;
- terminate during preview;
- corrupt cache;
- incomplete import;
- failed export;
- interrupted migration;
- quota failure;
- sync conflict;
- worker crash.

## 135. Performance tests

- selection;
- hover;
- snap;
- pan;
- zoom;
- orbit;
- wall commit;
- room rebuild;
- opening move;
- snapshot;
- archive;
- PDF;
- DXF;
- IFC viewer load later.

## 136. Security tests

- authorisation;
- share link;
- path traversal;
- zip bomb;
- parser fuzz;
- XSS in imported text;
- HTML in project name;
- malicious SVG if enabled;
- prompt injection in imported metadata;
- rate limits;
- expired signed URL.

## 137. Acceptance definition

A feature is complete only when:

- user problem is stated;
- non-goals are stated;
- normal flow exists;
- empty state exists;
- loading state exists;
- invalid state exists;
- failure state exists;
- keyboard behaviour exists;
- iPad behaviour considered;
- operation defined;
- undo defined;
- persistence tested;
- validation messages written;
- tests pass;
- performance measured;
- accessibility reviewed;
- docs updated;
- licence impact recorded.


# Part XXII. Product copy and diagnostics

## 138. Error-writing rules

An error must say:

1. what happened;
2. why;
3. what was affected;
4. what remains safe;
5. what the user can do.

Bad:

> Operation failed.

Good:

> The door overlaps the end of the wall by 74 mm. Move it inward, reduce its width, or extend the wall. No change was applied.

## 139. Model warnings

Examples:

- “Room is not enclosed. A 12 mm gap was found near Wall W-14.”
- “This dimension lost its wall reference after the wall was deleted.”
- “The imported drawing has not been calibrated. Measurements may not match the source.”
- “This IFC object was imported as reference geometry because its type is not yet editable.”
- “This project contains geometry above the tested authoring size. Editing may be slower.”

## 140. Save states

Use explicit language:

- Saved locally
- Saving locally
- Local save failed
- Syncing
- Synced
- Offline
- Sync conflict
- Recovered

Never show a single ambiguous “Saved” state when cloud sync has not completed.


# Part XXIII. Repository governance

## 141. Branches

- protected `main`;
- short-lived branches;
- draft PRs;
- no permanent develop branch initially;
- release branches only when needed.

## 142. Pull request requirements

- problem;
- solution;
- non-goals;
- screenshots or recording;
- tests;
- performance effect;
- accessibility effect;
- project-format effect;
- migration effect;
- dependency and licence effect;
- rollback.

## 143. Required checks

- format;
- lint;
- type;
- unit;
- property tests;
- golden geometry;
- visual regression where relevant;
- licence scan;
- vulnerability scan;
- SBOM;
- bundle budget;
- protected performance benchmarks;
- migration compatibility.

## 144. ADRs

Initial:

1. Web-first
2. Plan-first semantic model
3. Modular monolith
4. Units and numeric representation
5. Typed operations
6. Snapshots and journal
7. 2D renderer
8. 3D renderer
9. OpenCascade boundary
10. Project archive
11. IFC adapter
12. DXF adapter
13. Collaboration staging
14. AI operation model
15. Native iPad strategy
16. Authentication
17. Licensing policy
18. Analytics privacy


# Part XXIV. Execution roadmap

## 145. Phase 0: evidence and spikes

Deliverables:

- interviews;
- workflow synthesis;
- name clearance;
- clickable desktop;
- clickable iPad;
- 2D renderer comparison;
- OpenCascade.js spike;
- RepliCAD review;
- IndexedDB journal;
- `.arq` draft;
- wall-room mesh spike;
- first tokens;
- first icons.

Gate:

The team can defend the first user, workflow, project size, renderer, storage and export.

## 146. Phase 1: editor kernel

- coordinates;
- pan;
- zoom;
- input abstraction;
- command lifecycle;
- selection;
- area selection;
- snapping;
- numeric input;
- undo;
- local persistence;
- design-system components.

Gate:

Accurate linework survives reopen with reliable undo.

## 147. Phase 2: architectural slice

- levels;
- wall;
- joins;
- doors;
- windows;
- rooms;
- inspector;
- 3D mesh;
- synchronised selection.

Gate:

Moving a wall correctly updates openings, rooms and 3D.

## 148. Phase 3: documentation

- dimensions;
- labels;
- notes;
- sheet;
- vector PDF;
- revision metadata.

Gate:

Benchmark house produces a clean scaled PDF.

## 149. Phase 4: reliability

- recovery;
- safe mode;
- diagnostics;
- benchmark CI;
- accessibility;
- archive download;
- migration;
- privacy analytics.

Gate:

No known data-loss defect in protected workflow.

## 150. Phase 5: exchange

- DXF;
- IFC viewer;
- reports;
- support matrix;
- external validation.

## 151. Phase 6: review collaboration

- share;
- viewer;
- comments;
- issues;
- presence;
- revisions;
- roles.

## 152. Phase 7: bounded AI

- ArqScript;
- explain;
- single-step proposal;
- preview;
- validation;
- grouped undo;
- benchmarks.

## 153. Phase 8: native iPad

- native storage;
- Pencil;
- Files;
- offline;
- capture research.


# Part XXV. Ordered implementation backlog


The following backlog is ordered broadly by dependency. Issue details must include acceptance criteria from the relevant section.


1. `docs: add complete blueprint v1.0`


2. `docs: add ADR template`


3. `docs: add dependency and licence policy`


4. `research: create architect interview guide`


5. `research: create workflow synthesis template`


6. `research: conduct first six architect interviews`


7. `research: conduct second six architect interviews`


8. `research: map competitor residential plan workflow`


9. `research: document browser and iPad support matrix`


10. `legal: complete Arq working-name clearance`


11. `chore: initialise pnpm monorepo`


12. `chore: enable TypeScript strict mode`


13. `chore: configure formatting and linting`


14. `chore: configure unit and property test runners`


15. `chore: add pull request and issue templates`


16. `chore: add SBOM and licence scan`


17. `chore: add dependency update automation`


18. `design: create monochrome tokens`


19. `design: create typography tokens`


20. `design: create icon package`


21. `design: draw first 20 technical icons`


22. `design: draw remaining first 40 technical icons`


23. `design: build top bar`


24. `design: build tool rail`


25. `design: build model panel`


26. `design: build inspector shell`


27. `design: build status bar`


28. `design: build context bar`


29. `design: build command palette shell`


30. `design: prototype iPad landscape shell`


31. `design: prototype iPad portrait shell`


32. `editor: define coordinate systems`


33. `editor: implement pan and zoom`


34. `editor: implement fit view`


35. `editor: implement pointer input abstraction`


36. `editor: implement touch input abstraction`


37. `editor: implement keyboard input abstraction`


38. `editor: define command lifecycle state machine`


39. `editor: implement selection hit-test interface`


40. `editor: implement point selection`


41. `editor: implement window selection`


42. `editor: implement crossing selection`


43. `editor: implement candidate cycling`


44. `editor: implement selection filters`


45. `editor: define snap result contract`


46. `editor: implement endpoint snap`


47. `editor: implement midpoint snap`


48. `editor: implement intersection snap`


49. `editor: implement perpendicular snap`


50. `editor: implement grid snap`


51. `editor: implement extension snap`


52. `editor: implement snap tie-break`


53. `editor: implement numeric overlay`


54. `editor: support metric numeric input`


55. `editor: support imperial numeric input`


56. `editor: implement undo command stack`


57. `editor: implement redo`


58. `core: select canonical unit representation`


59. `core: define typed unit library`


60. `core: define ID types`


61. `core: define project schema v0`


62. `core: define level schema`


63. `core: define element base schema`


64. `core: define type and instance property states`


65. `operations: define operation contract`


66. `operations: define validation result contract`


67. `operations: implement create element operation`


68. `operations: implement update property operation`


69. `operations: implement delete element operation`


70. `operations: implement inverse operation tests`


71. `storage: add Dexie project database`


72. `storage: implement local journal`


73. `storage: implement snapshots`


74. `storage: implement quota handling`


75. `storage: implement abnormal-exit recovery`


76. `format: define arq manifest`


77. `format: implement archive checksums`


78. `format: implement arq export`


79. `format: implement arq import`


80. `format: implement migration framework`


81. `geometry: define tolerance policy`


82. `geometry: implement point and vector primitives`


83. `geometry: implement segment intersections`


84. `geometry: implement nearest point`


85. `geometry: implement polygon area and winding`


86. `geometry: evaluate robust predicates`


87. `geometry: evaluate polygon clipping`


88. `geometry: evaluate RBush`


89. `geometry: evaluate earcut`


90. `geometry: build geometry adversarial fixtures`


91. `bim: define wall type`


92. `bim: define wall instance`


93. `geometry: implement wall outline`


94. `editor: implement wall drawing tool`


95. `geometry: implement butt join`


96. `geometry: implement mitre join`


97. `geometry: implement T join`


98. `geometry: implement cross join`


99. `editor: implement trim wall`


100. `editor: implement extend wall`


101. `editor: implement split wall`


102. `editor: implement offset wall`


103. `bim: define hosted opening`


104. `bim: define door type and instance`


105. `editor: implement door placement`


106. `editor: implement door flip controls`


107. `bim: define window type and instance`


108. `editor: implement window placement`


109. `editor: implement opening overlap validation`


110. `bim: define room schema`


111. `geometry: implement room boundary graph`


112. `editor: implement room placement`


113. `editor: implement zoom to room gap`


114. `bim: implement room area`


115. `renderer: benchmark Canvas 2D`


116. `renderer: benchmark PixiJS WebGL`


117. `renderer: evaluate CanvasKit fallback`


118. `renderer: select 2D renderer through ADR`


119. `renderer: implement plan scene abstraction`


120. `renderer: implement stable line weights`


121. `renderer: implement selection rendering`


122. `renderer: implement snap glyph rendering`


123. `renderer: add Three.js WebGL scene`


124. `renderer: generate wall meshes`


125. `renderer: generate opening meshes`


126. `renderer: implement orthographic camera`


127. `renderer: implement orbit and fit`


128. `renderer: implement 2D and 3D shared selection`


129. `renderer: implement hide and isolate`


130. `inspect: build identity property group`


131. `inspect: build geometry property group`


132. `inspect: build type and instance group`


133. `inspect: build relationships group`


134. `inspect: build warnings group`


135. `inspect: build history group`


136. `docs: define dimension reference model`


137. `docs: implement linear dimension`


138. `docs: implement room label`


139. `docs: implement text note`


140. `docs: define sheet schema`


141. `docs: build one plan viewport`


142. `pdf: prototype pdf-lib vector export`


143. `pdf: implement font embedding tests`


144. `pdf: implement scale validation`


145. `pdf: add export metadata`


146. `reliability: implement corrupt cache recovery`


147. `reliability: implement safe mode`


148. `performance: define benchmark hardware`


149. `performance: add selection benchmark`


150. `performance: add room rebuild benchmark`


151. `performance: add render frame benchmark`


152. `accessibility: complete keyboard-only workflow`


153. `accessibility: add VoiceOver labels`


154. `accessibility: test 200 percent zoom`


155. `security: create threat model`


156. `security: fuzz arq archive`


157. `security: add file size and complexity limits`


158. `exchange: prototype DXF parser`


159. `exchange: define DXF support matrix`


160. `exchange: prototype web-ifc viewer`


161. `exchange: define IFC mapping report`


162. `collaboration: prototype presence only`


163. `collaboration: implement comments`


164. `collaboration: implement issues`


165. `collaboration: implement revision snapshots`


166. `ai: define ArqScript grammar v0`


167. `ai: implement ArqScript parser`


168. `ai: add ten deterministic benchmarks`


169. `ai: prototype explain selection`


170. `ai: prototype one-step wall edit proposal`


171. `ipad: test Pencil web input`


172. `ipad: prototype native hover`


173. `ipad: prototype RoomPlan conversion`


# Part XXVI. Go or no-go gates

## 154. Interaction gate

A new user completes the first plan workflow without external instruction.

## 155. Model gate

A wall edit updates plan, room, openings, dimensions and 3D predictably.

## 156. Recovery gate

Forced termination restores the last locally committed operation.

## 157. Document gate

A scaled vector PDF passes visual and physical scale checks.

## 158. Performance gate

Protected benchmark passes on supported hardware.

## 159. Exchange gate

DXF and IFC work is not released without transparent support reports.

## 160. AI gate

AI is structured, previewable, validated, undoable and measurably useful.

## 161. Native gate

Native iPad work continues only where it is measurably better than the browser.

## 162. Trust gate

The user can download and reopen an `.arq` archive without the cloud.


# Part XXVII. Critical critiques of the earlier plans

## 163. The earlier MVP was still too large

It combined:

- CAD;
- BIM;
- documentation;
- collaboration;
- AI;
- IFC;
- DXF;
- native iPad;
- recovery.

Correction:

One protected residential-plan workflow first.

## 164. “OpenCascade as the foundation” was too broad

Correction:

Purpose-built 2D semantics first. OpenCascade remains an isolated exact-solid option.

## 165. “WebGPU first” would be premature

Correction:

WebGL first, WebGPU capability path.

## 166. “Real-time collaboration from v1” would delay modelling

Correction:

Review collaboration before concurrent geometry authoring.

## 167. “AI-assisted” could dominate the product too early

Correction:

Manual deterministic commands first. AI starts with explanation and bounded edits.

## 168. Native LiDAR as the initial wedge was risky

Correction:

Capture remains valuable, but conversion quality depends on a strong editable model.

## 169. Full IFC and DWG expectations were unrealistic

Correction:

Published subsets, reports, DXF first, IFC viewing first, DWG later through licensed options if justified.

## 170. Dark mode from day one doubled QA

Correction:

Light appearance first.

## 171. Microservices were premature

Correction:

Modular monolith until scaling evidence.

## 172. Event sourcing could become architecture theatre

Correction:

Snapshots plus append-only recovery journal. Do not force replay-only reads.

## 173. Monochrome could damage clarity

Correction:

Patterns, labels, icons and optional accessible accents. Monochrome applies to chrome, not model content.

## 174. Generic icon libraries are insufficient

Correction:

Lucide for temporary generic actions, custom Arq technical family for CAD and BIM.

## 175. “Everything” cannot mean untested certainty

Correction:

Every unresolved choice receives a spike, gate, owner and evidence requirement.


# Part XXVIII. Immediate actions

1. Add this file at `docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md`.
2. Update README to identify it as the proposed consolidated source of truth.
3. Keep previous plans under `docs/history/` or retain clear superseded banners.
4. Create the first 18 ADRs.
5. Create issues 1 to 40 immediately.
6. Run interviews in parallel with the renderer and persistence spikes.
7. Build the wall-room-plan-3D slice before collaboration or public AI.
8. Create design tokens and the first 20 icons.
9. Establish benchmark devices and CI budgets.
10. Review every dependency licence before code reuse.
11. Do not promise launch dates before Phase 0 exits.
12. Do not describe Arq publicly as a Revit or AutoCAD replacement yet.


# Part XXIX. Research source catalogue

Accessed or reviewed on 21 July 2026 unless otherwise noted.

## User-supplied repositories

- https://github.com/earthtojake/text-to-cad
- https://github.com/FreeCAD/FreeCAD
- https://github.com/openscad/openscad
- https://github.com/LibreCAD/LibreCAD
- https://github.com/ferdous-alam/GenCAD
- https://github.com/lookup-foundation/RevitLookup

## Geometry and CAD

- https://github.com/donalffons/opencascade.js
- https://github.com/sgenoud/replicad
- https://github.com/jscad/OpenJSCAD.org
- https://github.com/solvespace/solvespace
- https://github.com/KittyCAD/ezpz
- https://github.com/hlorus/CAD_Sketcher
- https://github.com/AngusJohnson/Clipper2
- https://github.com/mourner/rbush
- https://github.com/mapbox/earcut

## BIM and exchange

- https://github.com/ThatOpen/engine_web-ifc
- https://github.com/ThatOpen/engine_components
- https://github.com/IfcOpenShell/IfcOpenShell
- https://github.com/IfcOpenShell/Bonsai
- https://github.com/xeokit/xeokit-sdk
- https://github.com/specklesystems
- https://github.com/buildingSMART/Sample-Test-Files
- https://technical.buildingsmart.org/standards/ifc/ifc-schema-specifications/
- https://github.com/buildingSMART/bSDD
- https://github.com/buildingSMART/IDS

## Rendering and UI

- https://github.com/mrdoob/three.js
- https://github.com/pixijs/pixijs
- https://github.com/konvajs/konva
- https://github.com/fabricjs/fabric.js
- https://github.com/paperjs/paper.js
- https://skia.org/docs/user/modules/canvaskit/
- https://github.com/adobe/react-spectrum
- https://github.com/radix-ui/primitives
- https://github.com/floating-ui/floating-ui
- https://github.com/lucide-icons/lucide

## Storage and collaboration

- https://github.com/dexie/Dexie.js
- https://sqlite.org/wasm
- https://github.com/electric-sql/pglite
- https://github.com/yjs/yjs
- https://github.com/automerge/automerge
- https://github.com/ueberdosis/hocuspocus

## File formats

- https://github.com/dxfjs/parser
- https://github.com/eacaps/dxf-parser-writer
- https://github.com/mozman/ezdxf
- https://github.com/LibreDWG/libredwg
- https://github.com/LibreCAD/libdxfrw
- https://github.com/Hopding/pdf-lib

## Apple and web platform

- https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- https://developer.apple.com/documentation/roomplan/
- https://developer.apple.com/documentation/arkit/
- https://developer.apple.com/documentation/uikit/apple-pencil-interactions
- https://www.w3.org/TR/webgpu/

## Authentication and observability

- https://authjs.dev/
- https://better-auth.com/
- https://github.com/keycloak/keycloak
- https://github.com/open-telemetry/opentelemetry-js

## Community research

Qualitative discussions reviewed in communities including:

- r/Architects
- r/architecture
- r/Revit
- r/bim
- r/AutoCAD
- r/cad
- r/Shapr3D

Community posts are treated as qualitative evidence, not statistical market research.


# Final direction

Arq should become broad only after it becomes dependable.

The first proof is a small architectural project in which:

- walls behave predictably;
- doors and windows remain hosted;
- rooms explain their boundaries;
- plan and 3D remain coordinated;
- dimensions remain trustworthy;
- every invalid operation fails safely;
- work survives a crash;
- a local archive remains available;
- the PDF looks professional;
- the interface remains calm;
- the codebase remains legally and technically maintainable.

Collaboration, IFC, AI, LiDAR, native apps and deeper BIM features should extend that foundation. They must not replace it.
# Part XXVII. Instant-everywhere architecture and the native Arq file system

## 27.1 Product-level correction

Arq must be instant because the user edits a local project replica, not because every
command waits for a server.

The same project must open consistently on web, iPadOS, macOS and Windows. This does
not require every device to expose the same density or every advanced authoring tool.
It requires:

- one semantic model;
- one operation contract;
- one native `.arq` format;
- one migration system;
- deterministic validation;
- local-first commits;
- adaptive rendering;
- clear capability tiers.

A phone may be a viewer and reviewer while a workstation supports large-model
authoring. Both must open the same `.arq` project and preserve its data.

## 27.2 The `.arq` decision

The `.arq` format should be a SQLite 3 database identified as an Arq application
file.

It is not a renamed ZIP and is not a directory of loosely coordinated JSON files.

SQLite provides:

- a stable cross-platform file format;
- transactions;
- indexes;
- incremental reads;
- BLOB storage;
- integrity checks;
- application and schema version identifiers;
- native libraries on desktop and mobile;
- an official WebAssembly build that can persist through OPFS in browsers.

The project database stores canonical semantic data, operations, relationships,
views, sheets, annotations, provenance and content-addressed resource metadata.

Disposable render meshes, spatial-index caches, thumbnails and generated projections
remain in a device-local cache unless the user requests a portable preview package.

## 27.3 Working copy versus exported project

Every platform edits a controlled local working replica.

- Browser: SQLite WASM in an OPFS Worker.
- macOS and Windows: native SQLite through the Rust core.
- iPadOS: native SQLite through the shared core and document integration.
- Cloud: authoritative operation stream, immutable snapshots and content-addressed
  resources.

An external file opened from Finder, Files, OneDrive, Dropbox or another provider is
copied into a local working replica. Arq publishes clean atomic snapshots back to the
external file. It does not run WAL directly across a remote or network file system.

An exported `.arq` contains one clean checkpointed SQLite database. It has no required
`-wal` or `-shm` sidecar.

## 27.4 Sync

Arq never synchronises raw SQLite pages between devices.

Devices synchronise:

- typed operations;
- stable element identifiers;
- preconditions;
- server-assigned revision sequence;
- content-addressed resource chunks;
- periodic compact snapshots.

Independent changes may rebase automatically. Destructive or semantically dependent
geometry conflicts require explicit resolution.

## 27.5 Shared deterministic core

Create a shared `arq-core` in Rust.

Compile it:

- to WebAssembly for browsers;
- as a native Rust library for desktop;
- through a stable FFI boundary for iPadOS;
- for server validation and migration jobs.

The shared core owns:

- identifiers;
- units;
- operation validation;
- operation application and inversion;
- deterministic model hashing;
- file-format migrations;
- resource hashing;
- sync preconditions;
- semantic validation;
- selected robust 2D geometry predicates.

The UI, React component system and renderer remain outside the core.

## 27.6 Instant interaction architecture

Opening a project occurs in stages:

1. Open the shell.
2. Read format header and project metadata.
3. Read last active view, level and spatial index.
4. Render coarse authoritative linework.
5. Load labels, annotations and underlay preview.
6. Load detailed plan primitives.
7. Generate or retrieve 3D meshes in a Worker.
8. Prefetch likely next views.
9. Sync in the background.

Commands also occur in stages:

1. Immediate local preview.
2. Deterministic validation.
3. Local transaction and operation journal.
4. UI reports Saved locally.
5. Derived systems invalidate incrementally.
6. Cloud sync occurs separately.

## 27.7 Performance budgets

Targets, not claims:

- App shell visible: under 500 ms from warm launch.
- Small project first useful view: under 1.5 seconds on the supported reference device.
- Medium project first useful view: under 3 seconds.
- Input feedback: one frame where possible, never more than 32 ms for normal tools.
- Selection median: under 50 ms.
- Local operation commit: under 100 ms for common edits.
- Durable local acknowledgement: under 250 ms.
- Command palette: under 100 ms.
- 2D navigation: 60 fps target, 30 fps minimum after graceful degradation.
- 3D navigation: 60 fps target, 30 fps minimum after graceful degradation.
- Common undo: under 150 ms.
- No main-thread task longer than 50 ms during normal authoring.
- Export and heavy import do not block the editor.

## 27.8 Device capability tiers

Tier A, full authoring:

- supported desktop and high-capability tablet;
- plan, 3D, sheets, imports, exports and advanced inspection.

Tier B, standard authoring:

- general laptop and supported iPad;
- complete protected workflow with adaptive 3D quality.

Tier C, light authoring and review:

- lower-memory tablet and high-capability phone;
- plan edits, annotations, comments, measurement and reduced model detail.

Tier D, review:

- low-memory phones and unsupported GPU configurations;
- view, comments, issues, measurements, revisions and exports already generated.

Capability detection is measured at runtime. Arq does not silently expose an
unsupported tool.

## 27.9 Canonical and derived data

Canonical:

- semantic entities;
- types and instances;
- exact user-authored parameters;
- constraints;
- relationships;
- operations;
- views and sheets;
- annotations;
- source imports;
- provenance;
- authoritative exact geometry where required.

Derived and replaceable:

- display meshes;
- 2D projection caches;
- snap indexes;
- selection indexes;
- room-boundary acceleration graphs;
- thumbnails;
- preview images;
- compiled shaders;
- format conversion caches.

The project can always open without derived caches.

## 27.10 Required gates

The `.arq` format cannot be frozen until:

- SQLite native and WASM prototypes open the same fixture;
- deterministic model hashes match on ARM64, x86-64 and WASM;
- crash and power-loss tests pass;
- copy-on-write migration tests pass;
- a clean export opens without WAL sidecars;
- OPFS quota and eviction behaviour is tested;
- a 2 GB synthetic project can be inspected without loading all resources;
- sync never copies the database file while it is being edited;
- unsupported future versions open read-only or fail with a recoverable message.
# Part XXVIII. Complete implementation contract

## 28.1 Definition of an implementation-ready feature

A feature is not complete when its ideal screenshot exists. It is complete only when:

- user problem and non-goals are written;
- desktop, iPad and restricted-device behaviour are specified;
- normal, empty, loading, offline, invalid, permission and failure states exist;
- command lifecycle and cancellation exist;
- typed operations and stable IDs exist;
- local durable persistence succeeds before confirmation;
- undo and recovery are tested;
- accessibility has an alternative to canvas-only interaction;
- performance is measured on a named fixture and device;
- telemetry excludes project content by default;
- security and licence effects are reviewed;
- documentation and support material exist.

## 28.2 Release 1 protected workflow

Release 1 protects one complete workflow:

1. Create a metric or imperial project.
2. Import and calibrate an image underlay.
3. Draw straight walls with numeric input and snaps.
4. Create joins and an internal wall.
5. Place doors and windows with valid hosting.
6. Create named rooms and calculated areas.
7. Add linear dimensions and text notes.
8. Open coordinated orthographic 3D.
9. Move a wall and observe valid dependent updates.
10. Create one sheet and export a scaled vector PDF.
11. Close abnormally and recover the last committed operation.
12. Export and reopen a clean `.arq` file.

No unrelated advanced feature may weaken this workflow.

## 28.3 Full platform expansion

The complete feature catalogue is in
`docs/product/FULL-PLATFORM-FEATURE-CATALOG.csv`. Items outside Release 1 are not
promises. They are controlled future scope with dependencies and evidence gates.

## 28.4 Quality rule

Unknown future defects cannot be listed in advance. The pack therefore includes:

- anticipated failure modes;
- root-cause categories;
- prevention controls;
- detection methods;
- required fixes;
- deterministic regression tests;
- release gates;
- incident and data-recovery rules.

The master register is `quality/BUG-FIX-MASTER.csv`.

# Part XXVIII. v4.0 visual and brand production amendment

## 28.1 Canonical brand

Use the supplied final ARQ logo system. Black, white and Phthalo Green `#0B6B50` are
the canonical brand colours. The application remains predominantly monochrome, with
green used as a functional accent.

## 28.2 Page system

The six rendering boards define 57 page and mode compositions. Every composition
must be implemented with responsive, accessible and state-complete behaviour. Board
screens do not override model, permission, security, legal or performance contracts.

## 28.3 Visual traceability

Every page is represented by:

- board and position;
- exact board crop;
- larger individual rendering;
- page specification;
- implementation acceptance states.

## 28.4 Claims

No placeholder price, date, certification, security control, uptime number or legal
copy shown in a rendering may ship without approval and supporting evidence.

## 28.5 Logo implementation

Use SVG for scalable interface placement, supplied web assets for browser/PWA, and
supplied CMYK PDFs for print. Never recreate the wordmark with live text.

## 28.6 Current execution order

Complete renderer selection, numeric representation, ArqFS parity and the protected
semantic vertical slice before expanding AI, collaboration or broad native platform
scope.

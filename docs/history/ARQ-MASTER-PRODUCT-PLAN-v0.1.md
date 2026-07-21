# Arq master product, design and engineering plan

**Document:** `ARQ-MASTER-PRODUCT-PLAN-v0.1.md`
**Status:** Foundational planning document
**Date:** 21 July 2026
**Product working name:** Arq
**Decision level:** Product direction, platform strategy, design system, technical architecture, repository strategy and execution roadmap

---

## 1. Executive decision

Arq should not begin as a direct clone of AutoCAD or Revit. Those products represent decades of accumulated workflows, file formats, edge cases and specialist tools. Trying to recreate all of that at once would produce a large, confusing and unreliable application before it produces a useful one.

Arq should begin as an **AI-assisted architectural design and documentation workspace** for architects and small design practices. Its first job is to help a user move from an early brief, sketch, site reference or rough plan to an editable, precise and inspectable building model that produces coordinated 2D drawings and a lightweight 3D model.

The initial product should be:

- browser-first and desktop-class;
- usable on iPad through Safari and as an installable web app;
- designed from the start for Apple Pencil, keyboard, mouse and trackpad;
- based on open and exportable project data;
- built around a semantic building model rather than disconnected lines;
- capable of producing coordinated plans, elevations, sections and schedules from one source model;
- AI-assisted, but deterministic, editable and reversible;
- visually monochromatic, precise and calm;
- cross-platform by architecture, not by later porting.

### Recommended launch order

1. **Web application for desktop and iPad browsers**
2. **Native iPadOS application** with deeper Apple Pencil, offline and file-system integration
3. **macOS and Windows desktop applications** using the shared editor and geometry core
4. **iPhone application** for viewing, mark-up, comments, measurements and approvals, not full authoring
5. Android tablet support after the interaction and performance model is proven

### Initial product wedge

The first serious version of Arq should focus on:

- residential and small commercial schematic design;
- editable floor plans;
- walls, columns, slabs, openings, doors, windows, stairs and rooms;
- levels, grids, dimensions, annotations and sheets;
- synchronised 2D and 3D views;
- area and room schedules;
- comments, revisions and version history;
- controlled AI commands that create or modify model elements;
- PDF, DXF, IFC and glTF export;
- reliable autosave and local recovery.

The first version should not attempt full structural engineering, MEP design, code approval, photorealistic rendering, construction estimating, direct RVT editing or every AutoCAD command.

---

## 2. Product vision

### 2.1 One-sentence vision

**Arq is a precise, open and approachable architectural workspace where a building can be drawn, modelled, inspected, documented and revised without fighting the software.**

### 2.2 Product promise

Arq should make common architectural work faster without hiding the model or taking control away from the architect.

A user should always be able to answer:

- What changed?
- Who changed it?
- Which element is selected?
- Why did an operation fail?
- What will the AI change before it changes anything?
- Which drawings will update if this object changes?
- Can I export my work in a useful format?
- Can I restore an earlier version?

### 2.3 Product principles

1. **The model is inspectable.** Every object has visible geometry, properties, relationships and history.
2. **The user remains in control.** AI proposes operations. It does not silently rewrite a project.
3. **2D and 3D are coordinated.** A wall is not one object in plan and another object in 3D.
4. **Open formats are first-class.** Import and export are product features, not grudging utilities.
5. **Performance is a feature.** The editor must feel immediate during normal work.
6. **Complexity appears when needed.** Beginners see understandable controls. Experts can go deeper.
7. **Every action is reversible.** Undo, history, snapshots and recovery are core architecture.
8. **The interface is calm.** Monochrome design supports focus and technical clarity.
9. **Touch is not a smaller desktop.** iPad interactions are designed for Pencil and fingers.
10. **Desktop is not a larger tablet.** Keyboard, mouse, shortcuts and multi-panel workflows remain powerful.
11. **No lock-in by design.** Users can keep local copies and export usable project data.
12. **AI output must be valid, not merely plausible.** Geometric, semantic and project rules are checked before application.

---

## 3. The problem Arq should solve

Architectural software frequently forces users to choose between power and usability.

Traditional CAD applications are precise and established, but can feel overloaded, command-heavy and difficult to learn. BIM applications coordinate building data, but often expose users to large amounts of internal complexity, fragile relationships, difficult family systems and slow project files. Tablet applications feel direct and approachable, but often lose capability, stability or performance as models become complex.

Arq should solve the gap between these categories:

- easier than a large legacy CAD or BIM suite;
- more structured than a drawing application;
- more reliable and inspectable than an image-generation tool;
- more capable than a lightweight floor-plan app;
- more open than a proprietary building database;
- more natural on iPad than a desktop interface squeezed onto a tablet.

---

## 4. Research findings converted into requirements

The following themes repeatedly appear in architect, BIM, CAD and iPad discussions. These are not merely complaints. Each one becomes a design requirement and a testable acceptance criterion.

### 4.1 Slow performance and crashes

**Observed problem**

Users report slow opening, synchronisation, selection, transformation and file handling in large or linked models. Tablet CAD users also report long pauses and crashes when geometry or imported vectors become complex.

**Arq requirements**

- Incremental project loading instead of loading the full project before interaction.
- Geometry processing in Web Workers or native background threads.
- Level-of-detail rendering for distant or inactive geometry.
- Separate semantic data from render meshes.
- Cache generated geometry by content hash.
- Never block the main interface thread for heavy model operations.
- Autosave operations locally before cloud acknowledgement.
- Crash-safe journal and automatic recovery.
- Performance diagnostics visible in developer and support modes.
- Hard performance budgets enforced in CI.

### 4.2 Bloated and inconsistent interfaces

**Observed problem**

Legacy applications accumulate ribbons, palettes, hidden modes, duplicate commands and specialised dialogs. Users struggle to understand which controls matter for the present task.

**Arq requirements**

- A small permanent tool rail.
- Contextual controls that appear after selection.
- One command palette for tools, settings, views and help.
- Clear modes with explicit names.
- No duplicate commands unless one is a shortcut or contextual entry point.
- Progressive disclosure for advanced properties.
- Consistent placement of confirm, cancel, apply and close actions.
- Every temporary mode must have a visible exit and respond to Escape.

### 4.3 Vague modelling failures

**Observed problem**

CAD tools frequently return messages such as “operation failed” without showing the offending face, edge, constraint or parameter.

**Arq requirements**

Every failed operation should return:

1. a human-readable explanation;
2. the affected element or geometry highlighted;
3. the rule or condition that failed;
4. one or more safe corrective actions;
5. a link to technical detail when required;
6. an unchanged model state.

Example:

> The opening overlaps the wall end by 74 mm. Move the opening inward, reduce its width, or extend the wall.

Never show only an internal exception code to a normal user.

### 4.4 Steep learning curve

**Observed problem**

Architectural tools require users to learn software vocabulary before completing simple work. Students and new users are uncertain which product or workflow to learn.

**Arq requirements**

- First-use project templates.
- Contextual learning inside real work.
- Searchable command palette with synonyms.
- Tooltips that include the result, not only the tool name.
- Inline examples in property fields.
- Guided first project that can be skipped.
- Visible keyboard shortcuts.
- Command history that teaches repeatable workflows.
- Plain-language names before specialist terminology.
- Advanced BIM terminology available, but not required for basic modelling.

### 4.5 Poor interoperability and IFC round-tripping

**Observed problem**

Users report difficult IFC mappings, lost semantics, manual parameter work and inconsistent round-tripping across applications.

**Arq requirements**

- Maintain an internal semantic model that maps explicitly to IFC concepts.
- Treat import as a reportable transformation, not a silent conversion.
- Provide an import summary: preserved, converted, simplified, unsupported and failed objects.
- Preserve stable external identifiers when possible.
- Maintain source-file provenance.
- Export validation report before download.
- Test against a maintained library of representative IFC files.
- Support IFC viewing before claiming full IFC authoring.
- Avoid claiming lossless round-tripping until benchmark evidence supports it.

### 4.6 Fragile collaboration and file locking

**Observed problem**

Traditional worksharing can slow down, create central-file problems or require users to understand locks and synchronisation internals.

**Arq requirements**

- Operation-based collaboration rather than repeatedly transferring one large monolithic file.
- Element-level ownership or conflict handling.
- Presence, cursors and selection indicators.
- Comments and issues separate from geometry operations.
- Branches or named design options for major alternatives.
- A visible sync state.
- Offline edits with later reconciliation.
- No silent conflict resolution for destructive geometry changes.
- Server-authoritative validation for high-risk concurrent operations.

### 4.7 Subscription lock-in and loss of access

**Observed problem**

Users dislike losing access to their own work, being unable to export without a paid tier, or depending on an online licence check.

**Arq requirements**

- Project owners can always download an Arq project archive.
- Core neutral-format exports remain available under clearly stated plan rules.
- Read-only access remains available after a paid plan ends.
- Local cached projects can open without a network connection.
- Pricing and limits are visible before a user invests in a workflow.
- No dark patterns around cancellation or data export.

### 4.8 Touch and Apple Pencil workflows that break under real work

**Observed problem**

Tablet CAD can feel excellent for simple models but become awkward with selection, precision, imported vectors, keyboard combinations or dense models.

**Arq requirements**

- Pencil, touch, mouse and keyboard are separate recognised input types.
- Pencil is used for precise pointing, drawing, hovering and contextual actions.
- Fingers are used primarily for camera movement, panning and broad selection.
- Palm rejection and gesture arbitration are explicit.
- Precision input is always available numerically.
- Selection cycling handles overlapping objects.
- Apple Pencil is helpful but not mandatory.
- Keyboard and Pencil can be used together without mode bugs.
- Large models degrade gracefully rather than becoming unresponsive.

### 4.9 Complicated object and parameter systems

**Observed problem**

BIM type systems, families, parameters and category rules can become hard to inspect and maintain.

**Arq requirements**

- Clear distinction between object type and object instance.
- Every inherited property shows its source.
- Override states are visible.
- Property groups use plain names.
- Custom properties are schema-controlled.
- Bulk editing is safe and previewable.
- Reusable components have explicit versioning.
- Parameters can be searched, filtered and audited.

### 4.10 Weak trust, provenance and document control

**Observed problem**

Architectural documents can be copied, altered or represented without reliable provenance.

**Arq requirements**

- Immutable revision records.
- Export metadata with project, revision and creator information.
- Optional cryptographic document hashes.
- Role-based permissions for issuing and approving sheets.
- Visible draft, review and issued states.
- Audit trail for critical changes.
- No claim that Arq itself provides a professional seal or regulatory approval.

---

## 5. Target users

### 5.1 Primary user

**Independent architects and small architecture practices** working on residential, interiors, renovations and small commercial projects.

Why this group:

- They feel the cost and complexity of large suites strongly.
- They often need one person to handle concept, drawing, presentation and coordination.
- They benefit from simpler collaboration and client review.
- Their projects are suitable for a focused first product.

### 5.2 Secondary users

- Architecture students learning coordinated 2D and 3D design.
- Interior architects and spatial designers.
- Small design-build teams.
- BIM coordinators reviewing lightweight models.
- Clients and consultants who need viewing, comments and approvals.

### 5.3 Users not targeted in the first release

- Large multidisciplinary infrastructure teams.
- High-rise construction documentation teams.
- Fabrication-detail modellers.
- Structural or MEP analysis specialists.
- Contractors requiring complete 4D or 5D workflows.
- Users expecting full RVT compatibility.

---

## 6. Jobs to be done

### Architect

- Turn a rough brief into an editable spatial arrangement.
- Draw a precise plan without configuring a large project environment.
- Move between plan and 3D without rebuilding the same geometry.
- Change a room, wall or opening and update dependent drawings.
- Compare design options.
- Explain a design to a client.
- Issue a clear PDF set.
- Exchange useful data with other tools.
- Find and correct model problems quickly.

### Student

- Learn how architectural objects relate.
- Produce plans, sections, elevations and simple schedules.
- Understand dimensions, levels, grids and object properties.
- Export clean presentation material.

### Reviewer or client

- Open a project without specialist software.
- Navigate the model.
- Measure and comment.
- Compare revisions.
- Approve or reject an issue.

---

## 7. Product scope

## 7.1 MVP capabilities

### Project setup

- Create, rename, duplicate, archive and restore projects.
- Select metric or imperial units.
- Define project location and north direction.
- Define levels and grids.
- Import a reference image or PDF underlay.
- Set drawing scale and precision.

### Architectural elements

- Walls with height, thickness, alignment and type.
- Slabs and floors.
- Columns.
- Openings.
- Doors and windows.
- Rooms and spaces.
- Basic stairs.
- Roof by footprint in a later MVP increment.
- Generic components with controlled parameters.

### Drawing tools

- Line, polyline, rectangle, arc and circle.
- Offset, trim, extend, split, join, move, rotate, mirror and array.
- Constraints and dimensions.
- Snaps: endpoint, midpoint, intersection, perpendicular, tangent, centre, grid and extension.
- Selection filters.
- Layers or visibility classes for imported and annotation content.

### Views

- Floor plan.
- Reflected ceiling plan after core plan support is stable.
- 3D orthographic and perspective view.
- Section.
- Elevation.
- Sheet layout.
- Saved views.

### Documentation

- Linear, angular and radial dimensions.
- Text notes.
- Tags.
- Room labels.
- Area schedule.
- Door and window schedules.
- Sheet numbers, titles and revision metadata.
- PDF export.

### Collaboration

- Invite project members.
- Viewer, commenter, editor and administrator roles.
- Comments pinned to model locations or sheets.
- Issue status and assignee.
- Version snapshots.
- Activity history.

### AI assistance

- Create a room arrangement from a structured brief.
- Add or modify walls and openings.
- Apply repeated changes.
- Explain an element or project rule.
- Find likely model problems.
- Generate a schedule or view from existing data.
- Convert a natural-language request into an editable operation preview.

### Import and export

- Arq project archive.
- PDF.
- DXF.
- IFC, initially with clearly stated support level.
- glTF or GLB for visual exchange.
- CSV for schedules.
- STEP only for selected solids or components, not as the primary building exchange format.

## 7.2 Explicit non-goals for MVP

- Complete AutoCAD command parity.
- Complete Revit feature parity.
- Native RVT reading or writing.
- Full parametric family editor.
- Structural calculations.
- MEP design and sizing.
- Automatic legal or building-code approval.
- Photorealistic rendering engine.
- Quantity take-off suitable for contractual billing.
- Construction scheduling.
- Point-cloud authoring.
- Generating permit-ready work without architect review.

---

## 8. Platform strategy

## 8.1 Why web-first

A web-first editor provides the best first foundation because it gives Arq:

- immediate access on Windows, macOS and iPadOS;
- one primary interface codebase;
- direct links for project review;
- cloud collaboration without a separate viewer product;
- WebAssembly support for geometry and file processing;
- WebGPU for modern rendering with a WebGL fallback;
- faster product iteration;
- easier deployment of bug fixes;
- a path to installable desktop shells later.

Safari 26 introduced WebGPU across macOS, iOS and iPadOS, making a high-performance browser renderer more practical than it was previously. Browser memory, file access, background execution and offline limits still require careful engineering. Web-first does not mean browser-only forever.

## 8.2 iPad strategy

The first iPad experience should be the responsive web editor and installable web app. A native iPadOS application should follow once the core editor model is stable.

The native iPad application should add:

- lower-latency custom Pencil input;
- Apple Pencil hover previews;
- double-tap and squeeze actions;
- Pencil haptics for snapping where supported;
- stronger offline project storage;
- document browser and Files integration;
- native sharing and drag-and-drop;
- better memory and background-task control;
- Metal renderer if the shared web renderer becomes a limitation.

The iPad product should target iPad first, not iPhone. An iPhone screen is suitable for reviewing and marking up drawings, not for full architectural authoring.

## 8.3 macOS and Windows strategy

After the web editor is stable, package the shared editor inside a desktop shell such as Tauri, with native services for:

- file-system access;
- large local files;
- native menus and shortcuts;
- background processing;
- automatic updates;
- offline-first projects;
- optional native geometry acceleration.

A fully native UI should be considered only if the web editor cannot meet measurable performance or interaction requirements.

---

## 9. Information architecture

## 9.1 Home

- Recent projects
- Shared with me
- Templates
- Archived
- Imports
- Team workspace
- Account and billing

## 9.2 Project workspace

Arq should use five principal work modes.

### Design

Create and modify building elements. Plan and 3D are the primary views.

### Document

Create dimensions, annotations, schedules and sheets.

### Inspect

Examine element properties, relationships, constraints, warnings and imported data.

### Review

Comments, issues, comparisons, approvals and revision history.

### Present

Clean model navigation, diagrams, views and client-facing presentation.

The same project data powers every mode. Modes only change the tools and panels shown.

---

## 10. Desktop interface plan

### 10.1 Main layout

- **Top application bar:** project name, undo, redo, save state, view controls, share and command search.
- **Left tool rail:** select, draw, building elements, annotate, measure and view.
- **Left model panel:** project tree, levels, views, sheets, schedules and imports. Collapsible.
- **Centre canvas:** plan, 3D, section, elevation or sheet.
- **Right inspector:** properties, constraints, relationships, warnings and history for the current selection.
- **Bottom status bar:** units, coordinates, snapping, selection count, model health and sync status.
- **Context bar:** appears near the top of the canvas after a tool or object is active.

### 10.2 Behaviour rules

- Escape exits the current action one level at a time.
- Enter confirms an operation when safe.
- Space temporarily pans.
- Tab cycles selectable objects under the cursor.
- Command search opens from a universal shortcut.
- Numeric input works while drawing without first clicking a field.
- Every tool shows its active state.
- Temporary constraints are visible.
- The canvas never shifts unexpectedly when a panel opens.
- Panels remember project-specific width and visibility.

---

## 11. iPad interface plan

### 11.1 Input roles

**Apple Pencil**

- precise selection;
- drawing and sketching;
- hover previews;
- handle manipulation;
- contextual palette;
- annotations;
- double-tap tool switching;
- squeeze for the contextual palette on supported hardware.

**Finger**

- pan;
- orbit;
- pinch zoom;
- broad multi-selection;
- panel interaction;
- drag and drop.

**Keyboard and trackpad**

- shortcuts;
- numeric entry;
- command search;
- precision navigation;
- desktop-style selection.

### 11.2 iPad layout

- Compact top bar.
- Left floating tool palette.
- Bottom contextual control strip.
- Inspector appears as a side panel in landscape and a resizable sheet in portrait.
- A Pencil hover palette previews the active tool and snap.
- Full-screen canvas remains available with one tap.
- Touch targets are at least 44 points, while geometry handles can use larger invisible hit areas.

### 11.3 Pencil-specific interactions

- Hover shows the target snap before contact.
- Haptic feedback confirms important snaps where supported.
- Squeeze opens a radial contextual menu.
- Double tap toggles the current tool and selection.
- Pencil drawing never accidentally orbits the camera.
- Finger contact during Pencil use does not create geometry.

---

## 12. Visual design system

## 12.1 Brand direction

Arq should look like a professional instrument, not a gaming interface, crypto dashboard or generic SaaS template.

The design should be:

- black and white;
- technically precise;
- spacious but not wasteful;
- quiet during normal work;
- high contrast where action is required;
- consistent across web, iPadOS, macOS and Windows.

## 12.2 Colour tokens

The application remains monochromatic. Status must never rely on colour alone.

- `ink-1000`: `#000000`
- `ink-950`: `#0A0A0A`
- `ink-900`: `#151515`
- `ink-800`: `#252525`
- `ink-700`: `#3A3A3A`
- `ink-600`: `#555555`
- `ink-500`: `#737373`
- `ink-400`: `#A3A3A3`
- `ink-300`: `#C7C7C7`
- `ink-200`: `#E2E2E2`
- `ink-150`: `#ECECEC`
- `ink-100`: `#F4F4F4`
- `ink-50`: `#FAFAFA`
- `paper`: `#FFFFFF`

### Selection and state treatment

- Primary selection: black outline plus light grey fill or inverse handles.
- Secondary selection: dashed dark outline.
- Locked: lock glyph plus diagonal pattern.
- Warning: triangular icon plus striped fill or dotted underline.
- Error: octagonal icon plus strong cross-hatch and text label.
- Pending AI proposal: animated dashed outline and “Proposed” badge.
- Collaborator selection: patterned outline and user initials, not colour-only identity.

A later optional accessibility setting may add distinguishable accent colours, but the default product remains monochrome.

## 12.3 Typography

### Primary typeface

**Plus Jakarta Sans**

Use for:

- navigation;
- buttons;
- panel labels;
- property names;
- headings;
- notifications;
- onboarding;
- marketing website.

Recommended weights:

- 400 Regular
- 500 Medium
- 600 SemiBold
- 700 Bold only for major product headings

### Technical typeface

**JetBrains Mono**

Use for:

- coordinates;
- dimensions during entry;
- IDs;
- command history;
- code-like formulas;
- diagnostic detail;
- file and schema names.

### Type scale

- 11 px: dense metadata only
- 12 px: status bar and secondary labels
- 13 px: default inspector and tool labels
- 14 px: default controls and menus
- 16 px: panel headings and primary input
- 20 px: page or dialog heading
- 28 px: project/home heading
- 40 px and above: marketing only

## 12.4 Spacing

Use a 4-point base grid.

- 4: icon-text micro gap
- 8: compact control gap
- 12: default internal gap
- 16: panel padding
- 24: section separation
- 32: large grouping
- 48: page-level separation

## 12.5 Corners and shadows

The application should avoid excessively rounded consumer-style cards.

- Small controls: 4 px radius
- Menus and popovers: 6 px radius
- Dialogs: 8 px radius
- Large marketing cards: maximum 12 px
- Canvas panels: square or 4 px corners
- Shadows: subtle and functional, used primarily for floating layers

## 12.6 Icon system

Use one coherent icon family.

### General icons

Start from an MIT-licensed outline system such as Lucide, then redraw and normalise required icons.

### CAD and BIM icons

Create a custom Arq technical icon set for:

- wall;
- curtain wall later;
- slab;
- roof;
- column;
- beam later;
- opening;
- door;
- window;
- stair;
- room;
- level;
- grid;
- section;
- elevation;
- sheet;
- schedule;
- dimension;
- constraint;
- trim;
- extend;
- offset;
- mirror;
- array;
- align;
- join;
- split;
- orbit;
- pan;
- zoom;
- isolate;
- hide;
- reveal;
- inspect;
- issue;
- revision;
- AI proposal;
- model validation.

### Icon construction rules

- 24 × 24 master grid.
- 20 × 20 compact variant where required.
- 1.75 px standard stroke.
- Round caps and joins for interface icons.
- Square or mitred joins only where technical meaning requires it.
- Optical alignment before mathematical centring.
- No filled icons except selected or destructive states.
- Every icon must be understandable at 16 px.
- Every icon requires default, hover, active, disabled and selected states.
- Do not mix icon libraries in production.

## 12.7 Motion

- Tool feedback: 80 to 120 ms.
- Panel transitions: 140 to 180 ms.
- Dialogs: 160 to 220 ms.
- Camera transitions: user-configurable and interruptible.
- AI proposal generation may use a subtle marching dashed outline.
- No decorative bounce or elastic motion.
- Respect reduced-motion settings.

---

## 13. Core interaction system

## 13.1 Selection

Selection must be predictable before the full toolset is developed.

- Click or Pencil tap selects the top eligible object.
- Repeated click or Tab cycles overlapping objects.
- Drag selects by window or crossing direction.
- Selection filters limit categories.
- Parent and child selection are explicit.
- Locked objects explain why they cannot be edited.
- Hidden objects remain searchable in the model tree.
- Selecting an object highlights it in every active coordinated view.

## 13.2 Snapping

Snap priorities should be visible and configurable.

Default priority:

1. endpoint;
2. intersection;
3. midpoint;
4. perpendicular;
5. centre;
6. tangent;
7. grid;
8. extension;
9. nearest point.

The user sees a small glyph and label for the active snap. A snap can be temporarily overridden from the keyboard or Pencil palette.

## 13.3 Numeric entry

During a draw or transform operation:

- typing starts numeric entry;
- Tab moves between distance, angle and other active fields;
- units can be entered inline;
- expressions are allowed later;
- invalid values explain the required range;
- the preview updates before confirmation.

## 13.4 Undo and history

- Every committed edit is undoable.
- Undo is operation-based, not a full-file reload.
- AI operations appear as grouped, expandable actions.
- Collaborative undo affects the current user’s eligible operations and does not silently undo another user’s work.
- Major operations create optional named snapshots.
- Restore creates a new revision rather than destroying history.

## 13.5 Command palette

The command palette should search:

- tools;
- views;
- sheets;
- objects;
- settings;
- recent commands;
- help;
- AI actions;
- imported files.

Search supports common synonyms such as “copy around” for array or “cut wall” for opening.

---

## 14. AI product architecture

AI should operate through a constrained command system, not by directly editing opaque geometry.

## 14.1 AI workflow

1. User enters a request.
2. Arq extracts measurable requirements and assumptions.
3. Arq asks only for information required to avoid an unsafe or meaningless result.
4. The AI creates a structured operation plan.
5. The geometry and BIM engines validate the plan.
6. Arq shows a visual preview and a written change list.
7. The user applies, edits or rejects the proposal.
8. The accepted operation is committed to project history.
9. The user can undo it as one action or inspect individual sub-operations.

## 14.2 ArqScript

Create an internal declarative domain-specific language named `ArqScript`.

Example:

```arq
level "Ground Floor" elevation 0mm

room "Living" {
  target_area: 28m2
  min_width: 4200mm
  adjacency: ["Kitchen", "Garden"]
}

wall W1 {
  from: grid(A,1)
  to: grid(D,1)
  type: "Exterior 230"
  height: level("First Floor")
}

place door D1 {
  host: W1
  type: "Single 900"
  offset_from: grid(B,1) + 600mm
}
```

ArqScript should be:

- human-readable;
- deterministic;
- versioned;
- schema-validated;
- unit-aware;
- convertible to model operations;
- suitable for tests and benchmarks;
- never the only stored representation of a project.

## 14.3 AI guardrails

- Never issue drawings or mark them compliant.
- Never claim structural safety.
- Never hide assumptions.
- Never overwrite the project without preview.
- Never invent missing dimensions when they materially affect the model without labelling the assumption.
- Never convert an image into “accurate CAD” without calibration.
- Never silently delete objects to make a command succeed.
- Never train on private project data by default.
- Keep prompts, generated operations and validation results auditable.

## 14.4 AI benchmark categories

- Text to simple architectural geometry.
- Text modification of an existing plan.
- Image or sketch interpretation with calibration.
- Constraint satisfaction.
- Door and window placement.
- Room adjacency.
- Schedule generation.
- Error diagnosis.
- Multi-step revision.
- Ambiguity detection.
- Invalid request rejection.

Each benchmark records:

- geometric correctness;
- semantic correctness;
- dimensional accuracy;
- constraint validity;
- number of assumptions;
- user edits required;
- operation latency;
- crash or failure rate.

---

## 15. Data model

Arq should own a clean semantic model independent of any one external file format.

## 15.1 Core entities

- Workspace
- Project
- Site
- Building
- Level
- Grid
- Element
- ElementType
- ElementInstance
- GeometryDefinition
- GeometryInstance
- Material
- PropertySchema
- PropertyValue
- Constraint
- Relationship
- View
- Sheet
- Annotation
- Schedule
- ImportSource
- ExportRecord
- Revision
- Operation
- Snapshot
- DesignOption
- Comment
- Issue
- User
- Role

## 15.2 Object identity

- Use stable UUIDv7 identifiers.
- Preserve external source identifiers separately.
- Never use display names as primary identifiers.
- Derived geometry receives content hashes.
- Element identity remains stable across normal parameter changes.

## 15.3 Type and instance model

An instance inherits values from its type.

Every property shows one of these states:

- inherited;
- overridden;
- calculated;
- imported;
- missing;
- invalid.

Users can promote repeated instance settings into a new type with preview.

## 15.4 Geometry separation

Store:

1. semantic intent;
2. editable parameters and constraints;
3. exact or authoritative geometry;
4. derived display meshes;
5. 2D projection caches.

Render meshes are disposable. They must never become the only authoritative project representation.

## 15.5 Operation log

Every model edit becomes a typed operation such as:

- `CreateElement`
- `UpdateProperty`
- `MoveElement`
- `ReplaceType`
- `CreateConstraint`
- `DeleteElement`
- `ImportElements`
- `ApplyAIProposal`

Operations include:

- actor;
- timestamp;
- project revision;
- preconditions;
- payload;
- result;
- validation outcome;
- affected element IDs;
- undo payload.

---

## 16. Technical architecture

## 16.1 Monorepo

Use a monorepo so the editor, shared schemas, geometry adapters, native shells and tests remain coordinated.

Recommended structure:

```text
arq/
├── apps/
│   ├── web/                 # Main browser product
│   ├── marketing/           # Public website and documentation
│   ├── ipad/                # Native iPadOS app when started
│   ├── desktop/             # Tauri macOS and Windows shell
│   └── api/                 # Public API gateway
├── packages/
│   ├── editor-shell/        # Panels, commands, shortcuts, state
│   ├── renderer/            # 2D and 3D rendering
│   ├── geometry-core/       # Shared geometry interfaces
│   ├── geometry-occt/       # OpenCascade adapter
│   ├── bim-core/            # Semantic building model
│   ├── ifc-adapter/         # IFC import and export
│   ├── dxf-adapter/         # DXF import and export
│   ├── arqscript/           # Parser, schema and executor
│   ├── collaboration/       # Presence, operations and sync
│   ├── design-system/       # Tokens, components and icons
│   ├── file-formats/        # Arq archive and migrations
│   ├── validation/          # Geometry and model rules
│   ├── telemetry/           # Privacy-conscious diagnostics
│   └── test-models/         # Golden and interoperability files
├── services/
│   ├── model-service/
│   ├── geometry-service/
│   ├── ai-orchestrator/
│   ├── export-service/
│   ├── collaboration-service/
│   └── thumbnail-service/
├── docs/
│   ├── product/
│   ├── research/
│   ├── adr/
│   ├── schemas/
│   ├── ux/
│   ├── licensing/
│   └── security/
├── benchmarks/
├── scripts/
├── .github/
├── LICENSE
├── NOTICE
├── SECURITY.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── README.md
```

## 16.2 Frontend

Recommended:

- TypeScript
- React for application shell and panels
- Vite for the editor package and fast development
- Next.js only where server rendering is useful, such as the public site and account surfaces
- Zustand or a similarly small state layer for UI state
- A command bus for model operations
- IndexedDB for local project cache and operation journal
- Web Workers for parsing, geometry and export

Do not put the full model in React component state.

## 16.3 Renderer

Recommended initial renderer:

- Three.js with WebGPU where available;
- WebGL fallback;
- custom selection and outline passes;
- instancing for repeated components;
- tiled or chunked scene graph;
- separate 2D plan renderer where necessary for crisp technical linework;
- vector-based sheet and PDF pipeline rather than screenshots.

WebGPU should be treated as an acceleration path, not the only supported renderer in the first release.

## 16.4 Geometry engine

Use a replaceable geometry interface.

### Initial approach

- Architectural primitives handled by the Arq semantic and parametric layer.
- OpenCascade.js evaluated in a dedicated Worker for robust B-rep and solid operations.
- Server-side geometry service available for operations too large or unsupported in the browser.
- Geometry results cached and validated.
- Keep the rest of Arq independent of OpenCascade-specific object types.

### Why not build a full geometry kernel first

A robust CAD kernel is a specialised, long-term engineering project. Arq should build product value above a kernel while keeping the option to replace or supplement components later.

## 16.5 IFC

Recommended:

- `web-ifc` as an isolated IFC parsing and writing adapter;
- a canonical mapping layer between IFC and Arq entities;
- import and export reports;
- test files across IFC2x3, IFC4 and selected IFC4.3 use cases;
- no direct dependency of editor logic on IFC classes.

Because `web-ifc` uses MPL-2.0, keep modifications and integration boundaries clear and review obligations before distribution.

## 16.6 Collaboration

Use a hybrid model.

- Yjs or another CRDT can handle presence, comments, text and selected metadata.
- Geometry changes use typed Arq operations.
- High-risk conflicting geometry operations are validated by the server.
- Element-level optimistic concurrency is allowed where safe.
- Major alternatives use design options or branches rather than attempting to merge every geometric intention automatically.

Do not represent an entire B-rep model as a naïve CRDT document.

## 16.7 Backend

Recommended baseline:

- PostgreSQL for project metadata, permissions and operation indexes.
- S3-compatible object storage for project snapshots, imports, exports and thumbnails.
- Redis for short-lived presence, queues and locks where needed.
- Rust for geometry-heavy and high-throughput services.
- TypeScript for application APIs where development speed matters.
- OpenTelemetry-compatible traces and metrics.
- Signed upload and download URLs.

## 16.8 Arq project format

Create a documented `.arq` archive.

Possible structure:

```text
project.arq
├── manifest.json
├── model/
│   ├── entities.msgpack
│   ├── relationships.msgpack
│   ├── operations.ndjson
│   └── schemas.json
├── geometry/
│   ├── authoritative/
│   └── cache/
├── views/
├── sheets/
├── imports/
├── thumbnails/
└── checksums.json
```

Requirements:

- versioned schema;
- documented migrations;
- checksums;
- deterministic archive generation where practical;
- human-readable manifest;
- recoverable even if optional caches are corrupted;
- no cloud-only data required to open the archive.

---

## 17. Review of the supplied repositories

The `earthtojake/text-to-cad` link was supplied twice. It is assessed once below.

## 17.1 `earthtojake/text-to-cad`

**What it is**

A skills library for agents that generate, inspect, preview and export CAD and related engineering artefacts. Its README describes STEP as a primary CAD output and also supports STL, 3MF, GLB, DXF and other workflows.

**Licence**

MIT, according to the repository README and licence badge.

**Useful ideas for Arq**

- Task-specific agent skills instead of one vague CAD prompt.
- Structured creation and validation workflow.
- CAD preview as part of the generation loop.
- Export verification.
- Benchmarks with precise geometry prompts.
- Separation between CAD creation, viewing, sourcing and manufacturing checks.

**Recommended use**

- Adapt workflow patterns.
- Study its skill boundaries and benchmark format.
- Potentially integrate compatible skills as developer tools.
- Use it as a reference for AI evaluation.

**Do not use it as**

- Arq’s geometry kernel.
- Arq’s architectural semantic model.
- Evidence that text-to-building generation is solved.

## 17.2 `FreeCAD/FreeCAD`

**What it is**

A cross-platform open-source parametric 3D modeller. It uses OpenCASCADE, Coin3D, Python and Qt. It supports parametric history, constrained sketches, drawings and architectural use cases.

**Licence**

GNU LGPL 2.1 in the inspected repository licence file. Individual components may have additional terms.

**Useful ideas for Arq**

- Parametric document and object model.
- Workbench separation.
- Python scripting and extensibility.
- OpenCascade integration.
- Sketch constraints.
- History-based editing.
- Architecture and BIM experimentation.
- Headless automation potential.

**Recommended use**

- Architectural and engineering reference.
- Prototype selected geometry or conversion workflows.
- Compare object and transaction models.
- Consider isolated headless conversion services only after legal and deployment review.

**Risks**

- Very large desktop-oriented codebase.
- Qt UI is not a basis for the planned web and iPad interface.
- Directly forking the application would inherit substantial complexity.
- LGPL obligations must be reviewed for any linked or distributed use.

## 17.3 `openscad/openscad`

**What it is**

A script-based solid modeller. It behaves like a 3D compiler using CSG, extrusion and parameterised scripts. The repository documents WebAssembly builds.

**Licence**

GNU GPL version 2 with a stated linking exception for CGAL.

**Useful ideas for Arq**

- Deterministic text-to-geometry pipeline.
- Human-readable scripted modelling.
- Parameterised design.
- Reproducible compilation.
- WebAssembly feasibility.
- Clear separation between source description and generated geometry.

**Recommended use**

- Study language and compiler behaviour for ArqScript.
- Use OpenSCAD-compatible export only if there is a real user need.
- Run external tools as isolated processes only after licence review.

**Risks**

- GPL makes direct integration into a closed-source product legally sensitive.
- CSG scripting is not a complete building information model.
- It is not an interactive architecture editor.

## 17.4 `LibreCAD/LibreCAD`

**What it is**

A mature cross-platform 2D CAD application based on the QCAD community edition. It includes established drafting behaviour and DXF-related tooling.

**Licence**

GNU GPL version 2.

**Useful ideas for Arq**

- 2D drafting command behaviour.
- DXF workflows.
- Snapping, selection and modification tools.
- Print and vector export concepts.
- Long-tested drafting edge cases.

**Recommended use**

- Behavioural reference for 2D tools.
- Interoperability test source.
- Evaluate associated DXF libraries separately under their own licences.

**Risks**

- Direct code reuse would trigger GPL considerations.
- Desktop Qt architecture does not match the planned product.
- The application is 2D CAD, not BIM.

## 17.5 `ferdous-alam/GenCAD`

**What it is**

A research implementation for image-conditioned CAD generation using contrastive representation learning and diffusion priors. The README references a TMLR 2025 paper and uses `pythonocc-core` for geometry-related work.

**Licence**

No clear licence file was surfaced during this inspection. Until an explicit licence is confirmed, treat the source code, pretrained models and dataset as unavailable for product reuse.

**Useful ideas for Arq**

- Image-conditioned CAD research direction.
- Learned CAD representations.
- Separation between visual input and parametric output.
- Evaluation of image-to-CAD limitations.

**Recommended use**

- Read the paper.
- Reproduce ideas only from independently implemented, legally permitted methods.
- Use it to inform research benchmarks.

**Risks**

- Research code is not production infrastructure.
- Missing or unclear licence.
- Dataset and model licences may differ from repository code.
- Generated mechanical CAD representations may not map cleanly to BIM.

## 17.6 `lookup-foundation/RevitLookup`

**What it is**

An interactive Revit project database exploration tool for navigating BIM element parameters, properties and relationships.

**Licence**

MIT.

**Useful ideas for Arq**

- First-class inspectability.
- Tree navigation through element relationships.
- Clear visibility into properties and database objects.
- A developer and support inspection mode.
- Revit add-in patterns for future interoperability tools.

**Recommended use**

- Adapt inspection concepts.
- Consider a future Arq connector or diagnostic companion for Revit.
- Use its MIT-licensed ideas or code only where technically suitable and with notices.

**Risks**

- It depends on the Revit API and is not a BIM authoring engine.
- Its UI and data structures should not dictate Arq’s internal model.

---

## 18. Additional open-source projects to evaluate

## 18.1 OpenCascade.js

Purpose: Open CASCADE bindings compiled to JavaScript and WebAssembly.

Potential use:

- browser B-rep operations;
- STEP import and export;
- solid booleans;
- geometry validation;
- custom builds with reduced API surface.

Licence: LGPL 2.1. Complete legal review and preserve replaceable boundaries.

## 18.2 That Open Engine `web-ifc`

Purpose: browser and Node.js IFC reading and writing through JavaScript, C++ and WebAssembly.

Potential use:

- IFC parser;
- IFC property access;
- IFC writing;
- regression models;
- browser-native BIM workflows.

Licence: MPL 2.0.

## 18.3 Speckle

Purpose: object-based AEC data exchange, versioning, viewing and connectors.

Potential use:

- study object-based collaboration;
- study connectors for Revit, Rhino, AutoCAD and other tools;
- possible future integration rather than rebuilding every connector;
- study AEC version history and model delivery patterns.

Licence: mixed. Much of the server is Apache 2.0, while selected enterprise modules use different terms. Review per directory and component.

## 18.4 Yjs

Purpose: CRDT-based collaborative data structures.

Potential use:

- comments;
- presence;
- shared text;
- lightweight metadata;
- collaborative UI state.

Licence: MIT.

## 18.5 Other projects for later evaluation

- IfcOpenShell
- Bonsai BIM
- xeokit
- Open Design Alliance products, commercial licence required
- RepliCAD
- That Open Components
- Blender geometry nodes as research reference
- BlenderBIM and native IFC workflows
- QCAD and libdxfrw under their applicable licences
- CGAL for selected server-side geometry if licence terms fit
- Rust geometry libraries for 2D constraints and polygon operations

---

## 19. Open-source and licensing policy

This project needs a formal policy before meaningful implementation begins.

### 19.1 Rules

- Every dependency must have an SPDX identifier.
- Maintain an automated software bill of materials.
- Block dependencies with missing licences.
- Record model, dataset and code licences separately.
- Do not assume a repository licence covers downloaded checkpoints or datasets.
- Keep copyleft components behind clear technical boundaries.
- Do not copy UI, icons, brand assets or documentation text from competitors.
- Include required notices in distributed applications.
- Run automated licence scanning in CI.
- Obtain legal advice before commercial distribution involving LGPL, GPL, MPL or mixed-licence AEC components.

### 19.2 Preliminary classification

| Repository or component |          Licence observed | Preliminary treatment                                               |
| ----------------------- | ------------------------: | ------------------------------------------------------------------- |
| text-to-cad             |                       MIT | Patterns and compatible code may be reused with notice              |
| FreeCAD                 |                  LGPL 2.1 | Reference or carefully bounded integration after legal review       |
| OpenSCAD                |                     GPL 2 | Avoid direct integration into proprietary core                      |
| LibreCAD                |                     GPL 2 | Behavioural reference; avoid direct core reuse                      |
| GenCAD                  | Unclear during inspection | No code, data or weight reuse until confirmed                       |
| RevitLookup             |                       MIT | Inspectability patterns and suitable code may be reused with notice |
| OpenCascade.js          |                  LGPL 2.1 | Isolated adapter and compliance review                              |
| web-ifc                 |                   MPL 2.0 | Isolated adapter; publish required modifications                    |
| Yjs                     |                       MIT | Suitable for collaboration features                                 |
| Speckle                 |                     Mixed | Review component by component                                       |

This is a planning assessment, not legal advice.

---

## 20. Performance plan

Performance requirements must be measurable from the first prototype.

## 20.1 Interaction budgets

Design targets, not current claims:

- Pointer or Pencil feedback: visible within one frame where possible.
- Basic selection response: under 50 ms.
- Common property edit preview: under 100 ms.
- Camera interaction: 60 fps target on supported devices.
- Large-model camera interaction: never below 30 fps for sustained normal navigation after adaptive degradation.
- Local operation journal write: under 100 ms.
- Autosave acknowledgement in the UI: under 1 second locally.
- Undo of a common operation: under 150 ms.
- Command palette open: under 100 ms.
- Small project interactive load: target under 3 seconds on a representative supported device and connection.

## 20.2 Model tiers for testing

### Small

- One building
- Up to 5 levels
- Up to 5,000 semantic elements

### Medium

- Multiple linked references
- Up to 20 levels
- Up to 50,000 semantic elements

### Large review model

- Up to 250,000 semantic elements
- View and review supported before full authoring is promised

These are engineering targets that may change after prototype benchmarks.

## 20.3 Degradation strategy

When the device or browser approaches limits:

- simplify distant geometry;
- suspend hidden view updates;
- delay nonessential thumbnails;
- use bounding boxes during movement;
- disable expensive edge effects;
- unload inactive levels;
- warn before memory exhaustion;
- preserve the local journal;
- offer server-side processing for heavy exports.

---

## 21. Reliability and recovery

- Local journal before remote sync.
- Periodic project snapshots.
- Checksummed project archives.
- Automatic recovery screen after an abnormal exit.
- Safe mode that disables optional plugins and heavy imports.
- Corrupt derived meshes can be regenerated.
- Import operations run in a temporary transaction.
- Export operations never modify the project.
- Long operations can be cancelled.
- Background jobs show progress and current stage.
- Server jobs are idempotent where practical.

---

## 22. Security and privacy

- Tenant isolation.
- Encryption in transit and at rest.
- Short-lived signed file URLs.
- Role-based access control.
- Project-level guest access with expiry.
- Audit events for sharing, export and issue actions.
- Private projects by default.
- No training on private projects by default.
- Clear AI data-processing settings.
- Data retention and deletion controls.
- Secret scanning and dependency security checks.
- Sandboxed file parsing.
- File-size and complexity limits to reduce denial-of-service risk.
- Fuzz importers for malformed IFC, DXF, SVG and project archives.

---

## 23. Testing strategy

## 23.1 Unit tests

- Geometry primitives.
- Units and conversions.
- Constraints.
- Property inheritance.
- Operation application and undo.
- ArqScript parser and validator.
- IFC mappings.
- DXF mappings.
- Permission rules.

## 23.2 Property-based tests

- Polygon operations.
- Transform composition.
- Round-trip serialisation.
- Unit conversions.
- Undo and redo invariants.
- ID stability.

## 23.3 Golden-model tests

Maintain versioned reference projects for:

- one-room plan;
- small house;
- multi-storey building;
- irregular walls;
- nested openings;
- stairs;
- linked references;
- imported IFC;
- imported DXF;
- conflicting edits;
- AI-generated operations.

## 23.4 Visual regression

- Icons.
- tool states;
- canvas selections;
- snapping;
- sheets;
- printed line weights;
- dark and light system appearance if dark mode is added;
- desktop and iPad breakpoints.

## 23.5 Interoperability tests

For every supported format:

- import;
- inspect;
- modify;
- export;
- reopen in Arq;
- open in at least one independent reference implementation;
- compare geometry and semantic reports.

## 23.6 Performance tests

- selection latency;
- camera frame time;
- operation latency;
- import time;
- export time;
- memory use;
- crash recovery;
- collaboration under concurrent edits.

## 23.7 Accessibility tests

- keyboard-only operation;
- screen reader labels for panels and controls;
- contrast;
- reduced motion;
- zoom and large text;
- status communication without colour;
- touch target size.

---

## 24. Product analytics

Track product usefulness without collecting private design content unnecessarily.

Useful events:

- project created;
- first element created;
- first coordinated 3D view opened;
- first sheet exported;
- import success or failure category;
- undo after AI proposal;
- AI proposal applied or rejected;
- collaboration invite accepted;
- crash recovery used;
- command search with no result;
- tool abandonment;
- validation warning resolved.

Do not record raw model geometry, project names, addresses or prompt text by default.

---

## 25. Business model hypotheses

Pricing should be tested only after product value is demonstrated. Do not design artificial restrictions that damage trust.

Possible structure:

### Free

- Viewer and commenter.
- Limited personal projects.
- Basic PDF export.
- Public templates.

### Professional

- Full authoring.
- Neutral-format exports.
- Offline access.
- AI usage allowance.
- Advanced documentation.

### Team

- Shared workspace.
- Roles and approvals.
- Organisation templates.
- Audit and administration.
- Higher storage and collaboration limits.

### Enterprise later

- SSO.
- Private cloud or regional hosting options.
- Advanced security.
- Custom integrations.
- Support agreements.

No prices should be set in this document.

---

## 26. Milestone roadmap

Use outcome gates rather than committing to dates before the team and technical spikes are known.

## Milestone 0: Product definition

Exit criteria:

- Primary user and project type confirmed through interviews.
- Top ten workflows ranked.
- Competitive workflow map completed.
- Product principles approved.
- Name and trademark risk assessed.
- Open-source policy approved.

Deliverables:

- Interview guide.
- Workflow maps.
- Product requirements document.
- Decision log.
- Initial clickable prototype.

## Milestone 1: Editor foundation

Exit criteria:

- Infinite canvas.
- Pan, zoom, orbit and selection.
- Line and polygon tools.
- Snapping.
- Numeric input.
- Undo and redo.
- Local project persistence.
- Basic renderer performance benchmarks.

## Milestone 2: Architectural model MVP

Exit criteria:

- Levels and grids.
- Walls, slabs, doors, windows and rooms.
- Coordinated plan and 3D view.
- Properties and type-instance model.
- Sections and elevations.
- Dimensions.
- Basic schedules.
- Arq archive.

## Milestone 3: Documentation and exchange

Exit criteria:

- Sheets.
- Vector PDF export.
- DXF export.
- IFC viewing and first controlled export.
- Import and export reports.
- Golden interoperability tests.

## Milestone 4: Collaboration

Exit criteria:

- Shared projects.
- Presence.
- Comments and issues.
- Version snapshots.
- Conflict handling.
- Offline journal and reconciliation.

## Milestone 5: AI-assisted operations

Exit criteria:

- ArqScript.
- Structured text-to-operation proposals.
- Visual preview.
- Validation.
- Grouped undo.
- Benchmark suite.
- Privacy controls.

## Milestone 6: Native iPadOS application

Exit criteria:

- Shared project model.
- Pencil hover, double tap and squeeze support.
- Offline Files integration.
- Keyboard and trackpad parity.
- Stable medium-project performance.

## Milestone 7: Desktop applications

Exit criteria:

- macOS and Windows packages.
- Native file handling.
- offline projects;
- reliable updates;
- performance parity with supported browsers.

## Milestone 8: Professional expansion

Possible additions:

- component and type library;
- advanced stairs and roofs;
- design options;
- renovation phases;
- BCF issues;
- consultant links;
- Revit, Rhino and AutoCAD connectors;
- scripting and plugin SDK;
- computational design;
- rendering integrations;
- code and sustainability analysis integrations.

---

## 27. Initial epics

1. Product research and interview programme
2. Arq brand and name clearance
3. Monochrome design system
4. Icon system
5. Canvas and camera
6. Selection and snapping
7. Numeric input and constraints
8. Command system
9. Local project persistence
10. Operation log and undo
11. Semantic building model
12. Wall system
13. Door and window hosting
14. Room and area engine
15. Levels and grids
16. 2D plan renderer
17. 3D renderer
18. Section and elevation generation
19. Annotation and dimensions
20. Sheet and vector PDF engine
21. Arq archive and schema migration
22. IFC adapter
23. DXF adapter
24. Collaboration and presence
25. Comments and issues
26. Version history and snapshots
27. ArqScript
28. AI proposal and validation pipeline
29. Performance instrumentation
30. Crash recovery
31. Security and permissions
32. Accessibility
33. iPad interaction layer
34. Desktop packaging
35. Developer SDK and connectors later

---

## 28. First repository issues to create

1. `docs: add product vision and non-goals`
2. `docs: add open-source dependency and licence policy`
3. `docs: create ADR template`
4. `chore: initialise monorepo and workspace tooling`
5. `chore: configure formatting, linting and type checking`
6. `chore: configure CI for web and shared packages`
7. `design: define monochrome tokens and typography`
8. `design: define technical icon grid and stroke rules`
9. `editor: implement canvas coordinate system`
10. `editor: implement pan and zoom`
11. `editor: implement desktop and iPad input abstraction`
12. `editor: implement selection hit testing`
13. `editor: implement snap engine prototype`
14. `editor: implement numeric entry overlay`
15. `core: define project and element IDs`
16. `core: define operation interface and undo contract`
17. `core: define wall semantic schema`
18. `renderer: create WebGPU capability spike with WebGL fallback`
19. `geometry: evaluate OpenCascade.js custom build size and latency`
20. `ifc: evaluate web-ifc import of reference models`
21. `storage: create IndexedDB operation journal spike`
22. `collaboration: prototype presence without geometry merging`
23. `ai: draft ArqScript grammar`
24. `ai: build one text-to-wall benchmark`
25. `testing: add golden model harness`
26. `performance: define supported benchmark devices`
27. `security: add threat model skeleton`
28. `accessibility: define keyboard navigation baseline`
29. `research: document top competitor workflows`
30. `research: run architect complaint and feature interview synthesis`

---

## 29. Repository governance

### Branches

- `main`: protected and releasable.
- Short-lived feature branches.
- Avoid a permanent development branch unless release operations require it.

### Pull requests

Every pull request should include:

- problem;
- proposed solution;
- screenshots or recordings for UI;
- tests;
- performance impact;
- accessibility impact;
- file-format impact;
- migration impact;
- licence impact for new dependencies.

### Required checks

- formatting;
- linting;
- type checking;
- unit tests;
- geometry tests;
- visual regression where relevant;
- licence scan;
- dependency vulnerability scan;
- bundle-size budget;
- performance benchmark for sensitive packages.

### Architecture decision records

Create ADRs for:

- web-first platform;
- renderer choice;
- geometry kernel boundary;
- semantic model;
- project file format;
- collaboration model;
- IFC strategy;
- AI operation model;
- iPad native strategy;
- desktop packaging;
- licensing decisions.

---

## 30. Critical risks

### Risk: trying to build AutoCAD and Revit simultaneously

Mitigation: maintain explicit MVP scope and non-goals.

### Risk: geometry kernel complexity

Mitigation: use replaceable established kernels and focus on architectural semantics.

### Risk: poor iPad performance

Mitigation: test representative devices from the first renderer prototype; progressive loading and server fallback.

### Risk: AI creates attractive but invalid designs

Mitigation: structured operations, validation, preview and benchmark suite.

### Risk: IFC claims exceed actual support

Mitigation: publish support matrices and import/export reports.

### Risk: copyleft licence contamination

Mitigation: dependency policy, isolated adapters, SBOM and legal review.

### Risk: monochrome interface reduces status clarity

Mitigation: patterns, icons, labels, line styles and optional accessibility accents.

### Risk: web app cannot support professional files

Mitigation: benchmark early, use Workers and WASM, add native or server services where evidence requires them.

### Risk: name conflict

Mitigation: conduct trademark, domain, app-store and repository-name clearance before public launch. “Arq” already appears in registered software-related marks and adjacent product names, so it should remain a working name until cleared.

### Risk: building before understanding architects’ real workflows

Mitigation: milestone 0 must include observed workflow research, not only feature requests.

---

## 31. Go or no-go gates

Do not proceed from prototype to broad implementation unless these gates pass.

### Interaction gate

A new user can create a simple room plan, dimension it and view it in 3D without external instruction.

### Performance gate

The supported benchmark device maintains acceptable navigation and selection latency on the defined small model.

### Model gate

Changing a wall updates the plan, 3D view, room boundary and affected dimensions predictably.

### Recovery gate

The editor can recover the last locally committed operation after an abnormal termination.

### Exchange gate

A defined IFC and DXF test set produces transparent reports and repeatable results.

### AI gate

AI proposals are structured, previewable, undoable and measurably more useful than manual creation for selected tasks.

### Trust gate

A user can download the project archive and open it offline.

---

## 32. Immediate next actions

The following actions should happen in order.

1. Keep **Arq** as the working codename and perform name clearance.
2. Create the new GitHub repository.
3. Add this planning document under `docs/product/`.
4. Add `README.md`, `LICENSE`, `NOTICE`, `SECURITY.md`, `CONTRIBUTING.md` and an ADR template.
5. Create the first 30 issues from this document.
6. Define the first user segment precisely: independent architects and small practices working on residential and small commercial projects.
7. Conduct workflow interviews focused on one recent project, not abstract feature wish lists.
8. Prototype the desktop canvas and iPad input model in the same web editor.
9. Run an OpenCascade.js geometry spike.
10. Run a `web-ifc` import and property-inspection spike.
11. Build one coordinated wall-room-plan-3D vertical slice.
12. Create the monochrome interface tokens and first 24 technical icons.
13. Define ArqScript version 0 with only levels, walls, openings and rooms.
14. Build the first ten deterministic AI and geometry benchmarks.
15. Review all dependency licences before copying code into the repository.

---

## 33. Questions to resolve through research, not guesswork

- Are small architecture practices the best first paying audience, or are students and independent designers a better entry point?
- Is the first high-value workflow schematic design, renovation documentation, floor-plan production or client review?
- Which neutral exchange format matters most in the first market?
- How frequently do target users need RVT, and would a connector satisfy the requirement?
- Which iPad models must be supported?
- Do users prefer command-driven drafting, direct manipulation or a hybrid?
- Which five operations consume the most time in a normal small project?
- Which project sizes are commercially important?
- How much offline work is required?
- Which parts of AI assistance are trusted and which are rejected?
- What information must appear in an import report for users to trust it?
- Is monochrome sufficient for multi-user presence, or should optional accessible accents be available?

---

## 34. Research sources reviewed for this plan

### User-supplied repositories

- https://github.com/earthtojake/text-to-cad
- https://github.com/FreeCAD/FreeCAD
- https://github.com/openscad/openscad
- https://github.com/LibreCAD/LibreCAD
- https://github.com/ferdous-alam/GenCAD
- https://github.com/lookup-foundation/RevitLookup

### Additional technical references

- https://github.com/donalffons/opencascade.js
- https://github.com/ThatOpen/engine_web-ifc
- https://github.com/specklesystems
- https://docs.yjs.dev/license
- https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- https://developer.apple.com/documentation/uikit/apple-pencil-interactions

### Community problem research

- Reddit discussions in `r/Architects`, `r/architecture`, `r/Revit`, `r/bim`, `r/cad`, `r/Shapr3D`, `r/3Dmodeling` and related communities concerning performance, interoperability, learning curve, pricing, file ownership, collaboration and iPad workflows.
- Autodesk support documentation concerning Revit freezing, slow cloud synchronisation and WAN or VPN worksharing.
- IFC interoperability research and benchmark literature.

---

## 35. Final product direction

Arq should become a modern architectural operating environment, but it should earn that position one dependable workflow at a time.

The winning first product is not “Revit in a browser” and not “AutoCAD with an AI chat box”. It is a focused architectural editor with:

- precise direct manipulation;
- an understandable building model;
- coordinated drawings;
- open exchange;
- fast collaboration;
- transparent AI operations;
- reliable recovery;
- a disciplined monochrome interface;
- first-class iPad interaction;
- a core architecture that can later power web, iPadOS, macOS and Windows.

That foundation can expand into a broad CAD and BIM platform. Without it, adding more tools will only reproduce the problems users already complain about.

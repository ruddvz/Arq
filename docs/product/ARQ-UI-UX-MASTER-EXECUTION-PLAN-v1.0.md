# ARQ UI/UX master execution plan v1.0

**Status:** Planning source for issue creation and implementation sequencing  
**Date:** 13 September 2026  
**Scope:** ARQ editor UI, UX, interaction design, visual system, responsive behaviour, accessibility, performance-facing UX, error/recovery states, AI review UX, cross-view consistency and implementation sequencing  
**Stop point for this revision:** Plan only. This document does not create GitHub issues, implement UI, merge code or change product scope.  

## 0. Authority and how to use this file

This file is the issue-generation and execution plan for ARQ editor UI/UX. It does not replace the product blueprint, accepted ADRs, Engineering OS, the ARQ Language System, `.zeus/INVARIANTS.md`, or current implementation evidence. When this file conflicts with any higher-authority source, the higher-authority source wins and this file must be corrected.

The intended workflow is:

1. use this file to create coordinated GitHub epics and implementation issues;
2. give every issue one owner and an explicit file/area scope;
3. respect existing issue-claim and shared-file ownership rules;
4. implement in dependency order;
5. prove each interaction with focused tests and browser evidence;
6. update this file when a decision, dependency or implementation state changes;
7. do not mark a phase complete because isolated components exist: the relevant end-to-end workflow must work.

This file is deliberately implementation-aware. It assumes the current ARQ architecture remains authoritative and treats Pascal Editor as a high-value reference implementation, not as ARQ's new foundation.

## 1. Current-state reading

### 1.1 Verified from the current repository

ARQ already has a real workspace shell with a top bar, project tabs, mode/tool rails, browser and inspector panels, command palette, status bar and phone/tablet compositions. It also has an interactive plan canvas with pan, zoom, wall drawing, snapping, marquee selection, hover, fit and typed undoable operations. A user-reachable 3D surface renders through WebGL2 and shares selection with the plan view. The repository also contains local recovery, `.arq` open, project browser/inspector plumbing, plan/3D geometry libraries, command and operation systems, import/export libraries and an MCP boundary.

The most important current UI/UX gaps are not “we need a UI.” They are that major systems remain disconnected or only partially productised. In particular:

- canvas edits do not yet reliably flow into the native `.arq` working copy;
- import/export libraries are not yet fully reachable from the product UI;
- door/window/room tools and other editor-library capabilities remain incompletely wired;
- 3D is a viewing surface, not yet a complete authoring surface;
- component/icon/tool-command coverage is incomplete;
- the MCP/Review Centre model is not yet user-reachable;
- bundle and capability costs still matter, so a UI rewrite that increases start-up weight without measurable benefit is unacceptable.

### 1.2 Inferred product problem

ARQ's risk is not lack of capability. It is fragmentation. The user should experience one coherent architectural editor even though the implementation is split across project loading, operations, validation, plan rendering, 3D rendering, file workers, local recovery, command systems and future AI review.

The UI/UX programme therefore has one central job:

> Make every ARQ capability feel like part of one predictable editor, with one interaction grammar, one semantic operation path, one set of state rules and one set of trust signals.

## 2. North-star experience

A first-time architect should be able to open ARQ and understand, without reading documentation, how to:

1. create or open a project;
2. choose a level;
3. draw and modify walls precisely;
4. place doors and windows;
5. define and inspect rooms;
6. dimension and annotate the plan;
7. switch to coordinated 3D and understand that it is the same model;
8. inspect object properties without losing context;
9. undo, redo and recover confidently;
10. place work on a sheet;
11. export a scaled PDF;
12. close and reopen the project without uncertainty about what was saved, recovered, published or left only in a working copy.

The interface should feel quiet when the user is thinking and precise when the user is acting.

## 3. Non-negotiable UX principles

### 3.1 Canvas first

The architectural content is the product. Permanent chrome must earn its screen space. The plan or model should occupy the majority of the viewport at all common desktop and tablet sizes.

### 3.2 Progressive disclosure

Do not expose every command simultaneously. Show global navigation globally, current-mode tools contextually and object-specific controls only when selection or tool state makes them relevant.

### 3.3 One operation, many surfaces

Plan, 3D, inspector, keyboard commands, command palette and future AI actions must produce the same semantic ARQ operations. No surface may invent a private mutation path for convenience.

### 3.4 Predictable modes

Every active mode or tool must have a visible state, a clear exit, an Escape behaviour, an undo story and a cursor/selection rule. Switching panels must not silently leave dangerous tools armed.

### 3.5 Precision without ceremony

A user should be able to start geometrically with pointer/Pencil input and then type an exact dimension without opening a modal. Snaps, constraints and numeric overrides should work together.

### 3.6 Trust is visible

Open, saving, saved, unsaved, recovered, read-only, migration, import conversion, export and AI-apply states must be explicit. The UI must never imply that bytes were written when they were not.

### 3.7 Same building, same selection

Selecting a wall in the model tree, plan, 3D or inspector must resolve to the same semantic object and produce consistent highlight and property state.

### 3.8 Error states are part of the feature

Failures must identify what happened, what was or was not changed, what can be retried and what the user should do next. Silence is a defect.

### 3.9 Responsive means recomposed, not shrunk

Desktop, tablet and phone should share concepts but not identical composition. A desktop sidebar compressed into a phone screen is prohibited.

### 3.10 Performance is UX

Heavy surfaces must be lazy where possible, active manipulation must stay responsive, and visual quality must degrade deliberately rather than unpredictably on weaker hardware.

## 4. Pascal Editor adoption boundary

Pascal Editor is a strong UI and architecture reference because it demonstrates a coherent browser-first building editor with a canvas-first layout, resizable/collapsible side panels, floating controls, mobile bottom sheets, level management, registry-driven tools, direct manipulation and WebGPU-oriented renderer hardening.

Use Pascal in four categories.

### ADOPT

Adopt the user-facing idea, implemented in ARQ's systems:

- canvas-first composition;
- compact icon/mode rail with collapsible panels;
- contextual floating canvas controls;
- compact level/storey management;
- direct manipulation with visible snap/constraint feedback;
- mobile/tablet bottom-sheet composition;
- tool-state disarming when leaving the relevant context;
- clear separation between navigation controls and object editing controls;
- lazy loading around heavy tool/view boundaries.

### ADAPT

Translate the idea into ARQ semantics:

- Pascal's node/plugin contribution model becomes an ARQ element/tool contribution model;
- Pascal-style tool hints become ARQ contextual tool HUD entries;
- Pascal scene-event immediacy becomes ARQ semantic-operation preview and Review Centre feedback;
- Pascal item catalogue patterns can later inform an ARQ component/library browser;
- Pascal level selector patterns become ARQ storey navigation that respects ARQ project/model rules.

### REFERENCE ONLY

Study but do not import directly:

- WebGPU renderer lifecycle and device-loss handling;
- React Three Fiber implementation details;
- Pascal's scene registry and dirty-node system;
- Pascal's Zustand/Zundo persistence/history approach;
- Pascal's particular styling, colours and control shapes;
- Pascal's metres-first internal assumptions.

### REJECT AS ARQ FOUNDATION

Do not replace ARQ with:

- Pascal's scene data model;
- Pascal's canonical storage/history model;
- Pascal's renderer as canonical model state;
- a second undo system;
- a second project persistence model;
- a second command system;
- a new units decision made as a side effect of UI work;
- a WebGPU migration performed merely because Pascal uses WebGPU.

Any source code copied or substantially adapted from Pascal must go through ARQ dependency/licence policy and preserve required MIT attribution.

## 5. Target desktop information architecture

The desktop workspace should converge on five zones.

### Zone A: project/global bar

Contains only project-global actions and state:

- ARQ/product mark;
- current project title;
- project tabs where applicable;
- save/working-copy state;
- undo/redo;
- command/search entry;
- account/collaboration state only when real;
- high-level export/share actions only when available.

This bar must not become a ribbon.

### Zone B: mode rail

A narrow persistent rail owns high-level work contexts such as model, document, inspect/review and future AI/review surfaces. It should be icon-first, keyboard reachable and able to collapse or swap the adjacent panel.

Re-clicking the active panel should collapse it when that is safe. Collapsing or leaving a tool-specific context must disarm incompatible build modes.

### Zone C: contextual left panel

The left panel is resizable and optional. It hosts one primary task at a time, for example:

- project browser;
- object/tool catalogue;
- layers/visibility;
- import review;
- AI/review thread;
- sheet browser.

It must not host duplicate controls already exposed by the inspector or canvas HUD.

### Zone D: canvas

The canvas is the visual centre. Plan, 3D, sheet and future elevation/section surfaces should share the same surrounding interaction language.

The canvas may contain floating controls for:

- view kind;
- level/storey selector;
- zoom/fit/orbit helpers;
- snapping/constraint state;
- active-tool HUD;
- compact selection actions;
- model-health or warning indicators when relevant.

### Zone E: inspector

The inspector owns selected-object properties and selection-aware actions. It should be dockable/collapsible, should preserve canvas visibility and must not duplicate the entire project browser.

Inspector principles:

- stable property grouping;
- exact numeric entry;
- units-aware input and display;
- validation close to the field;
- mixed-value handling for multi-select;
- reset/revert where meaningful;
- destructive actions separated visually and requiring appropriate confirmation;
- no property edit that bypasses semantic operations.

## 6. Universal interaction grammar

Every editing tool should implement the same lifecycle where applicable:

1. **Arm**: tool becomes visibly active.
2. **Acquire**: pointer/Pencil/keyboard establishes the first anchor or selection.
3. **Preview**: geometry follows input without mutating committed semantic state.
4. **Constrain**: grid, angle, endpoint, midpoint, perpendicular, parallel or semantic snaps appear as explicit candidates.
5. **Specify**: the user may type exact dimensions/angles while the preview is active.
6. **Commit**: validation runs and one semantic operation group commits atomically.
7. **Continue or finish**: continuation rules are explicit per tool.
8. **Cancel**: Escape/right-click/back cancels the current draft without corrupting prior committed work.
9. **Undo**: one conceptual user action maps to one understandable undo unit.

The HUD should explain only the controls relevant to the current lifecycle state.

## 7. Selection and manipulation

Selection must be unified across project browser, plan, 3D and inspector.

### Required states

- hover;
- selected;
- primary selection inside multi-select;
- highlighted/search result;
- locked/read-only;
- invalid/conflicted;
- hidden but selected through another surface;
- AI-proposed but not committed;
- remote-selected later, when collaboration exists.

### Manipulation rules

- clicking empty canvas clears selection unless an active tool owns the click;
- Shift/Cmd/Ctrl behaviour must be platform-appropriate and documented by the shortcut system;
- marquee selection must visibly distinguish crossing/window semantics where supported;
- handles appear only for manipulations the current selection can perform;
- handles must not overlap object-selection hit regions unpredictably;
- drag preview and final commit must resolve through the same snapping/validation rules;
- 2D and 3D manipulation of the same semantic object must generate compatible operation payloads.

## 8. Plan authoring UX

Release-1 plan editing gets first priority.

### Walls

Wall authoring should provide:

- chain drawing;
- clear endpoint/midpoint/grid snap feedback;
- angle constraints;
- typed length and angle entry;
- closure feedback;
- wall join/split behaviour that is visible before commit where possible;
- predictable continuation and finish controls;
- editable endpoints after creation;
- direct numeric wall properties in inspector;
- no hidden destructive join that cannot be undone as one action.

### Doors and windows

Door/window placement should provide:

- host-wall targeting;
- preview before commit;
- side/hand/swing or window-side preview where supported by model semantics;
- offset dimension feedback to adjacent geometry;
- exact width/height/sill input where model supports it;
- drag-along-host manipulation;
- invalid-placement explanation rather than silent refusal.

### Rooms

Room UX should distinguish:

- automatic enclosed-region discovery;
- manually defined room boundary where supported;
- room label/identity;
- area derived from model truth;
- unbounded/invalid room state;
- room selection that does not make underlying walls impossible to select.

### Dimensions and notes

Dimensioning must feel native to architectural work, not like a generic SVG annotation tool. Dimension placement needs semantic snapping, editable witness/label placement where supported and stable value formatting. Text note entry should be direct and keyboard-first.

## 9. Coordinated 3D UX

Do not attempt to reproduce a full general-purpose 3D modelling application in Release 1.

The first 3D UX goal is coordinated inspection with carefully selected direct edits.

Required progression:

1. reliable camera navigation and fit;
2. selection parity with plan/model tree;
3. level isolation and whole-building modes;
4. section/cut controls only when technically supported;
5. object inspector parity;
6. direct move/reshape only for operations that already have a canonical semantic operation path;
7. visible hand-off to plan for edits that are safer or clearer in 2D.

No 3D affordance should write renderer transforms as project truth.

## 10. Storey/level navigation

Introduce a compact storey selector visible from both plan and 3D.

The selector should eventually support:

- current level name and elevation;
- switch level;
- add above/below;
- rename;
- duplicate with explicit options;
- reorder only if project semantics permit it safely;
- storey height/elevation editing;
- visibility/isolation controls;
- delete with protected-baseline rules and dependency explanation;
- keyboard navigation.

The compact control should show the common action quickly and open a richer popover/panel for advanced operations.

## 11. Project browser and model tree

The project browser should answer “what is in this project and where am I?” It should not become a second inspector.

Required behaviours:

- levels, views, sheets and semantic categories are visually distinct;
- counts are secondary, not dominant;
- selection syncs with canvas;
- search/filter is available once project scale justifies it;
- context menu commands use the same command registry as keyboard/palette actions;
- hidden/locked/read-only states are visible;
- expansion state persists appropriately;
- large trees virtualise rather than slowing the editor;
- impossible actions are disabled with a reason, not simply missing when discoverability matters.

## 12. Inspector system

The inspector becomes the single authoritative UI for object properties.

Define a standard section order:

1. identity;
2. placement/geometry;
3. type/construction;
4. appearance where supported;
5. relationships/host;
6. data/metadata;
7. diagnostics;
8. destructive actions.

Every field must declare:

- data source;
- semantic unit;
- display formatter;
- edit parser;
- validation behaviour;
- mixed-selection behaviour;
- read-only behaviour;
- operation created by edit.

This makes property editing auditable and prevents one-off components from mutating project state directly.

## 13. Command system and command palette

Do not build a second command system for the new UI.

The ARQ command registry should become the source for:

- menu actions;
- command palette;
- context menus;
- keyboard shortcuts;
- toolbar buttons;
- contextual HUD actions;
- accessibility names;
- future agent-discoverable actions where appropriate.

Each command should declare availability, disabled reason, shortcut, context, undo expectations and telemetry identifier.

The command palette should support fuzzy search, recent commands, current-context ranking and object-aware commands without becoming the only way to discover important actions.

## 14. Context bar and active-tool HUD

The context bar/HUD should be redesigned as the temporary workspace for the current action.

It may show:

- active tool;
- current snap mode;
- exact numeric input;
- mode toggles relevant to the active tool;
- finish/cancel;
- one-line hint;
- validation message.

It should not become a second permanent toolbar.

## 15. File, persistence and recovery UX

This is a trust-critical UI area.

### Open

Open flow must distinguish:

- acquiring file;
- detecting format;
- copying to ARQ working area;
- migration when required;
- hydration;
- recovery discovery;
- read-only safe mode;
- success;
- failure.

The user should always know whether the original selected file remains unchanged.

### Save/publish terminology

The UI must use repository-governed language and must not claim “saved” when only a journal or working copy changed. Working-copy state, local journal state and published/exported file state must not be collapsed into one icon.

### Recovery

When recovered changes exist, show:

- what was recovered;
- from when;
- whether it is now part of the working project;
- what action will make it durable;
- how to discard it safely.

### Import

Import UX needs staging and review. Never drop converted geometry directly into the project without telling the user what was imported, approximated, skipped or failed.

### Export

Export should show format, scope, scale/settings, known limitations and a clear success/failure result. File generation failure must never be represented as success merely because a dialog closed.

## 16. AI and Review Centre UX

ARQ's AI UI must be visibly different from a generic chat assistant.

The core unit is a proposed project change.

Every AI turn that can modify a project should expose:

- user request;
- interpreted scope;
- assumptions;
- proposed typed operations;
- affected elements;
- validation result;
- visual preview where practical;
- apply/reject controls according to policy;
- undo after apply;
- explicit partial-failure state;
- retry when safe.

If an AI stream fails after applying any changes, ARQ must say exactly which changes were committed, which were not and what undo/retry options remain. Silent partial mutation is prohibited.

## 17. Responsive composition

### Desktop

Use resizable/collapsible side regions and floating contextual controls. Keep the canvas dominant.

### Tablet/iPad

Use a persistent canvas with edge panels or draggable sheets. Pencil must target the canvas directly. Inspector/tool configuration should occupy a sheet/drawer rather than permanently shrinking the canvas.

Required tablet work includes:

- Pencil hover where platform permits;
- deliberate palm rejection behaviour inherited from browser/native capabilities;
- larger hit targets without visually oversized controls;
- keyboard attachment support;
- split-view/window resize behaviour;
- persistent active-tool indication even when its sheet is collapsed.

### Phone

Phone is primarily for review, light editing and field/reference tasks until proven otherwise. Use bottom sheets and a compact dock. Do not pretend every desktop authoring workflow is equally usable on a phone.

## 18. Accessibility and input parity

Every core workflow must be operable with keyboard plus pointer. Touch and Pencil have explicit alternative paths where hover or right-click is unavailable.

Required baseline:

- logical tab order;
- visible focus;
- accessible names for icon-only controls;
- no colour-only state communication;
- keyboard access to command palette, undo/redo, escape/cancel, selection movement where appropriate and common view commands;
- screen-reader-readable dialog titles/descriptions and progress/error states;
- reduced-motion support for non-essential animation;
- target sizes suitable for touch surfaces;
- focus restoration after dialogs/popovers;
- shortcut collision testing across macOS, Windows and browser-reserved combinations.

## 19. Visual system direction

ARQ should remain restrained and architectural rather than copying Pascal's visual skin.

### Visual goals

- low-chrome canvas-first composition;
- strong hierarchy through spacing, grouping and typography before colour;
- monochromatic application chrome with semantic colour reserved for state and model feedback;
- crisp 1px/2px separators and carefully controlled elevation;
- compact but not cramped controls;
- consistent radius and control-height families;
- typography that handles numeric/tabular values well;
- selected/hover/snap/error colours that remain distinct in light/dark themes;
- no decorative gradients or heavy cards where a simple panel is clearer.

### Required design tokens

The design system must centrally own at least:

- spacing scale;
- control heights;
- panel widths/min/max;
- radii;
- border weights;
- typography scale;
- icon sizes;
- focus ring;
- selection colours;
- snap colours;
- warning/error/success/info colours;
- canvas overlays;
- z-index/layer contract;
- motion durations/easing;
- touch target minimums.

No feature team should create local near-duplicate tokens for common shell interactions.

## 20. Empty, loading, disabled and error states

Every major surface needs designed states, not placeholders added at the end.

At minimum define:

- no project;
- project loading;
- project read-only;
- no selection;
- multi-selection;
- panel empty because feature has no data;
- unavailable capability;
- import/export in progress;
- worker failure;
- GPU/view failure;
- offline/local-only;
- recovery available;
- migration failure;
- validation failure;
- AI unavailable;
- AI failed before changes;
- AI failed after partial changes;
- permission denied later, when collaboration exists.

A disabled control should provide a reason when the reason is useful to the user's next decision.

## 21. Performance-facing UX requirements

Set product-facing performance budgets before visual polish work expands.

Track at least:

- first usable workspace after app load;
- time to open `.arq` reference project;
- time to switch level;
- pan/zoom frame consistency;
- drag/reshape latency;
- selection-to-inspector response;
- plan-to-3D tab switch;
- command palette open latency;
- large-tree interaction latency;
- memory after repeated project open/close;
- deferred 3D chunk loading;
- import/export progress responsiveness.

Heavy features such as 3D, PDF writing, import adapters, AI panels and large catalogues should remain lazy or worker-backed when technically appropriate.

## 22. UX telemetry and diagnostics

Instrumentation should answer whether interaction design works, without becoming invasive.

Useful events include:

- tool armed/completed/cancelled;
- undo immediately after tool completion;
- invalid operation reason;
- snap type chosen;
- command palette search with no result;
- panel collapse/expand;
- level switch duration;
- import conversion summary;
- recovery acceptance/discard;
- AI proposal applied/rejected/undone;
- renderer fallback/failure;
- file-open failure class.

Do not use telemetry as a substitute for deterministic tests or user research.

## 23. Execution phases

### Phase UX-0: inventory and contract freeze

Goal: prevent redesign work from creating duplicate systems.

Deliverables:

- current workspace/component map;
- current command/tool map;
- current panel ownership map;
- current responsive composition map;
- design-token audit;
- interaction-state audit;
- Pascal reference ledger with ADOPT/ADAPT/REFERENCE/REJECT labels;
- explicit list of systems that must be extended rather than replaced.

Exit gate: every later UI issue can name the existing component/system it extends or the documented reason a new one is required.

### Phase UX-1: shell and visual hierarchy

Goal: make ARQ feel like one canvas-first editor before adding more tools.

Work:

- refine top/project bar;
- simplify mode/tool rail hierarchy;
- standardise collapsible/resizable panels;
- define canvas overlay zones;
- improve inspector docking/collapse;
- unify spacing/control tokens;
- remove duplicated shell controls;
- prove desktop, tablet and phone compositions.

Exit gate: workspace-layout visual/interaction tests pass at all supported breakpoints with no loss of existing functionality.

### Phase UX-2: command, selection and context unification

Goal: one interaction language across surfaces.

Work:

- canonical command metadata;
- context bar/HUD contract;
- selection state contract;
- context menu integration;
- keyboard/shortcut matrix;
- consistent disabled reasons;
- model-tree/plan/3D/inspector selection parity.

Exit gate: the same command and selection behave consistently regardless of entry surface.

### Phase UX-3: Release-1 plan authoring completion

Goal: make the protected residential-plan workflow genuinely usable.

Work:

- wall drafting polish;
- typed numeric drafting;
- door/window wiring and placement UX;
- room wiring and state UX;
- dimension/note interaction polish;
- multi-select/reshape;
- property inspector editing;
- undo grouping;
- validation messages.

Exit gate: a user can build the protected benchmark-style small residential plan without falling into disconnected/library-only tools.

### Phase UX-4: levels, project browser and coordinated 3D

Goal: make project navigation and plan/3D coordination feel native.

Work:

- compact level selector;
- level visibility/isolation;
- project-browser hierarchy polish;
- 3D camera/view controls;
- 3D selection parity;
- limited direct 3D edits only where semantic operations already exist;
- plan hand-off for unsupported 3D edits.

Exit gate: moving through levels and between plan/3D never loses semantic context.

### Phase UX-5: file, import/export and recovery UX

Goal: close the gap between editor interactions and trustworthy project/file state.

Work:

- connect edits to working-copy persistence with accurate UI state;
- open/migration/recovery states;
- import staging/review;
- export workflow;
- save/publish terminology enforcement;
- error/retry flows;
- capability/read-only explanation.

Exit gate: the user can explain where their work exists and how to make it durable at every point in the workflow.

### Phase UX-6: sheet/document workflow

Goal: complete the end of the Release-1 workflow.

Work:

- view placement on sheet;
- sheet navigation;
- scale controls;
- title/annotation interactions within approved scope;
- PDF export review;
- print/export error handling.

Exit gate: new/open project to coordinated model to scaled PDF works end to end.

### Phase UX-7: AI Review Centre

Goal: make agent assistance inspectable and trustworthy.

Work:

- proposal cards/operation diff;
- assumptions and validation;
- affected-object highlighting;
- apply/reject/undo;
- partial failure/retry;
- history/evidence view;
- MCP host connection UX when backend path is ready.

Exit gate: no AI mutation can occur invisibly and every committed AI change has an understandable undo path.

### Phase UX-8: accessibility, resilience and performance hardening

Goal: prove the editor under real constraints.

Work:

- keyboard-only passes;
- screen-reader/dialog passes;
- touch/Pencil passes;
- reduced motion;
- weak-GPU/fallback states;
- large-project interaction budgets;
- repeated open/close memory checks;
- visual regression suite;
- cross-browser matrix;
- responsive edge cases;
- error-injection tests.

Exit gate: UI/UX quality is proven, not inferred from happy-path screenshots.

## 24. Issue-generation protocol

The next agent should convert this plan into GitHub issues, not one giant redesign issue.

### 24.1 Epic structure

Create one epic for each execution phase UX-0 through UX-8. Create focused child issues beneath each epic.

Each child issue must contain:

- user problem;
- current repository evidence;
- exact in-scope files/components or discovery instructions;
- explicit out-of-scope items;
- interaction states;
- desktop/tablet/phone implications;
- keyboard/touch/Pencil implications where relevant;
- semantic operation/persistence implications;
- accessibility requirements;
- performance implications;
- error/empty/loading states;
- acceptance criteria;
- required tests/benchmarks;
- screenshots or visual baselines required;
- dependencies and conflicting active issues/PRs;
- rollback or safe failure expectation;
- evidence required before closing.

### 24.2 Issue sizing

Prefer vertical slices that a single agent can complete and prove. Avoid “redesign the editor” issues.

A good issue changes one coherent interaction, such as:

- collapse/reopen behaviour for the left workspace panel;
- unified disabled-reason contract for commands;
- wall numeric-entry HUD;
- level selector v1;
- door placement preview and exact offset;
- project-tree selection parity with Plan/3D;
- recovery banner and durable-state action;
- AI partial-failure card.

### 24.3 Shared-file ownership

Before issuing parallel work, identify high-conflict files such as the root app shell, workspace state, command registry, core canvas interaction state and shared design tokens. Give each shared file one active owner or sequence dependent issues explicitly.

### 24.4 No speculative issue explosion

Do not create implementation issues for features outside approved release scope merely because Pascal or another competitor has them. Record later ideas as deferred research or backlog references.

## 25. Initial issue seed map

These are planning seeds, not created GitHub issues. The issue-creation agent should validate current code and existing open work before turning any seed into a real issue.

### UX-0 seeds

- audit workspace shell ownership and duplicate controls;
- audit design tokens and local visual constants;
- audit command/tool registrations versus implemented capabilities;
- audit selection state across tree/plan/3D/inspector;
- audit responsive breakpoints and tablet/phone composition;
- create Pascal adoption ledger with licence provenance.

### UX-1 seeds

- canvas-first desktop shell refinement;
- left rail and panel collapse/reopen contract;
- inspector dock/collapse contract;
- canvas overlay zoning and z-index contract;
- shared panel/header/control tokens;
- empty/no-project shell polish;
- tablet composition refinement;
- phone review/light-edit composition refinement.

### UX-2 seeds

- canonical command metadata;
- command palette context ranking;
- unified context-menu command dispatch;
- shortcut dialect audit;
- active-tool HUD framework;
- disabled-reason UI;
- unified selection visual states;
- multi-select primary-selection semantics;
- focus restoration and keyboard escape/back behaviour.

### UX-3 seeds

- wall drafting cursor/snap feedback pass;
- wall exact-length/angle entry;
- wall reshape handles and undo grouping;
- door placement wiring and preview;
- door hand/swing interaction where model supports it;
- window placement wiring and sill/size editing;
- room tool wiring and unbounded-room state;
- dimension placement interaction pass;
- note editing interaction pass;
- inspector numeric-field validation and units behaviour;
- plan manipulation error messaging;
- plan tool keyboard/Pencil parity.

### UX-4 seeds

- compact level selector v1;
- level add/rename/duplicate/delete UX;
- level visibility/isolation controls;
- project-browser hierarchy and virtualisation;
- plan/3D/model-tree selection parity tests;
- 3D camera control polish;
- 3D level isolation;
- safe direct 3D manipulation for existing semantic operations;
- unsupported-3D-edit hand-off to plan.

### UX-5 seeds

- working-copy save-state model in shell;
- edit-to-native-session persistence UI integration;
- open/migrate/hydrate progress states;
- recovery review flow;
- read-only safe-mode UX;
- import staging shell;
- import summary and warnings;
- export configuration and success/failure flow;
- publish/download-copy wording and status consistency.

### UX-6 seeds

- sheet navigation shell;
- place view on sheet interaction;
- view scale controls;
- sheet selection/inspector parity;
- PDF export review and progress;
- export failure recovery.

### UX-7 seeds

- Review Centre shell;
- AI proposal operation list;
- affected-object highlight/preview;
- assumptions and validation presentation;
- apply/reject/undo controls;
- AI transport failure state;
- AI partial-apply state;
- safe retry behaviour;
- MCP connection/status UX.

### UX-8 seeds

- keyboard-only benchmark flow;
- touch/Pencil benchmark flow;
- screen-reader/dialog audit;
- reduced-motion pass;
- visual regression matrix;
- weak GPU/render failure state;
- large project browser virtualisation benchmark;
- repeated open/close memory benchmark;
- interaction latency budget gate;
- responsive extreme-size tests.

## 26. Definition of done for any UI/UX issue

An issue is not done because the component looks right in one screenshot.

A UI/UX issue is done only when all applicable conditions are met:

1. the intended user interaction works end to end;
2. no parallel/duplicate state path was introduced;
3. semantic mutations use ARQ operations and validation;
4. undo/redo behaviour is proven;
5. loading, empty, disabled, error and read-only states are handled where relevant;
6. keyboard behaviour is defined and tested;
7. touch/Pencil behaviour is defined where relevant;
8. accessibility names/focus are correct;
9. responsive behaviour is checked at required breakpoints;
10. performance impact is measured for interaction-critical changes;
11. focused tests pass;
12. required visual/browser evidence is captured;
13. public/product wording passes ARQ language rules where copy changed;
14. the issue documents evidence and any remaining limitation honestly.

## 27. Release-level UX acceptance flow

The UI/UX programme is successful only when this workflow is dependable:

1. launch ARQ;
2. create or open a valid `.arq` project;
3. understand file/working-copy state;
4. choose the correct storey;
5. create and edit a small residential plan precisely;
6. add doors, windows, rooms, dimensions and notes;
7. navigate project structure without losing selection/context;
8. inspect the same elements in coordinated 3D;
9. undo/redo and recover correctly;
10. place the required view on a plan sheet;
11. export a scaled PDF;
12. close/reopen the project;
13. verify the expected work remains present;
14. complete the flow with no silent errors, false save claims or unexplained mode traps.

This flow outranks isolated polish tasks.

## 28. Things the issue-creation agent must not do

Do not:

- replace ARQ's project model with Pascal's;
- replace ARQ operations/validation with renderer or component state;
- create a second command palette or second undo system;
- decide canonical units incidentally;
- migrate to WebGPU as part of UI polish;
- make unapproved Release-2+ features prerequisites for Release 1;
- create fake collaboration, cloud-save or AI capabilities in the interface;
- hide unavailable functionality behind misleading enabled controls;
- merge large shell rewrites without breakpoint and interaction evidence;
- treat a screenshot match as sufficient proof;
- create multiple parallel issues that all edit the same root shell/state file without ownership sequencing;
- mark a phase complete while its end-to-end workflow remains broken.

## 29. Immediate next action

The next action after approval of this plan is to run an issue-creation pass against the current repository and open the UX-0 through UX-8 epics plus the first dependency-safe child issues. That pass must first inspect current open issues and pull requests so it does not duplicate already-active work.

Implementation should then begin with UX-0 and the dependency-safe parts of UX-1/UX-2, while Release-1 authoring issues in UX-3 are created with explicit dependencies on the shared interaction contracts they require.

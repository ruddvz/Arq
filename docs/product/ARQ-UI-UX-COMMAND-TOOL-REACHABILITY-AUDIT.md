# ARQ UI/UX command and tool reachability audit

**Issue:** #398  
**Programme:** #377  
**Phase:** UX-0  
**Audited branch/head:** `main` @ `028a5125aca41da7069af805be8515a6a2776497`  
**Evidence type:** static repository/product-wiring inspection  
**Status:** current audit, not a browser capability claim

## 1. Purpose

This audit separates four things that are currently easy to confuse:

1. a command/tool is specified in a registry;
2. code for some part of it exists in the repository;
3. the shell exposes an enabled UI entry point;
4. the real product surface consumes that command and produces the intended behaviour.

Only the fourth is product reachability.

The broader capability ledger is owned by #370. This file is the command/tool evidence input for that ledger and for UX-2. It must not become a competing capability authority.

## 2. Current command architecture

There is **not yet one canonical command descriptor registry**.

Current metadata/dispatch is split across:

- `packages/workspace/src/registry/workspace-tool-registry.json` for 54 designed tools;
- `packages/workspace/src/tool-state.ts` for the 11 tool IDs that have repository backing;
- `packages/workspace/src/registry/workspace-keyboard-map.json` for 10 keyboard command contracts;
- local `COMMAND_ENTRIES` inside `apps/web/src/App.tsx` for the command palette;
- local top-bar and phone-menu action definitions in `App.tsx`;
- `packages/design-system/src/shell/command-palette*.ts*` for palette presentation/search only;
- `packages/command-system` for drawing-command lifecycle, not a global command registry;
- individual feature handlers in `App.tsx`, `PlanCanvas.tsx`, `ModelCanvas.tsx` and project/export modules.

That split is the primary architectural reason #420 is required.

## 3. Important distinction: repository backing is not product reachability

`packages/workspace/src/tool-state.ts` explicitly distinguishes registry design coverage from repository backing and lists 11 backed IDs:

`select`, `window-select`, `crossing-select`, `selection-filter`, `wall`, `door`, `window`, `room-boundary`, `pan`, `zoom`, `fit`.

The tool rail treats those 11 as available when their mode allows them.

However, the current `PlanCanvasProps` contract says the canvas responds to **select / wall / pan / fit** as active tool IDs. The canvas also implements zoom by wheel/pinch and window/crossing selection as behaviour inside its existing interaction system, but those are not evidence that separately arming the registry IDs `zoom`, `window-select` or `crossing-select` produces a product tool flow.

Therefore **module backing cannot be used as the enabled/disabled predicate for a product tool without an additional product-consumer check**.

## 4. Tool registry reachability matrix

Classification vocabulary:

- **PRODUCT-WIRED:** enabled tool ID has a current product active-tool consumer.
- **BACKED-BUT-UNWIRED:** code/module exists and the rail can enable the ID, but no equivalent current active-tool product consumer was found in the audited product path.
- **DESIGN-ONLY-DISABLED:** registry entry is visible where its group is active but `toolUnavailableReason` disables it because there is no repository backing.

### Select

| Tool ID | Classification | Current evidence / note |
| --- | --- | --- |
| `select` | PRODUCT-WIRED | Plan canvas active-tool consumer; palette and `V` shortcut can arm it |
| `window-select` | BACKED-BUT-UNWIRED | region-selection module exists, but current Plan active-tool contract does not list this ID; marquee/window behaviour exists under current selection interaction |
| `crossing-select` | BACKED-BUT-UNWIRED | same distinction as `window-select` |
| `selection-filter` | BACKED-BUT-UNWIRED | repository module is named in backing list; no current product active-tool consumer found |
| `select-similar` | DESIGN-ONLY-DISABLED | no repository backing |

### Draw

| Tool ID | Classification | Current evidence / note |
| --- | --- | --- |
| `wall` | PRODUCT-WIRED | Plan canvas wall tool and canonical commit callback are wired; palette and `W` shortcut can arm it |
| `room-boundary` | BACKED-BUT-UNWIRED | room placement module exists and palette/rail can arm ID, but current Plan active-tool contract does not consume it |
| `reference-line` | DESIGN-ONLY-DISABLED | no repository backing |
| `grid` | DESIGN-ONLY-DISABLED | no repository backing |

### Build

| Tool ID | Classification | Current evidence / note |
| --- | --- | --- |
| `door` | BACKED-BUT-UNWIRED | door placement module exists and palette/rail can arm ID, but current Plan active-tool contract does not consume it |
| `window` | BACKED-BUT-UNWIRED | window placement module exists and rail can arm ID, but current Plan active-tool contract does not consume it |
| `opening` | DESIGN-ONLY-DISABLED | no repository backing |
| `column` | DESIGN-ONLY-DISABLED | no repository backing |
| `slab` | DESIGN-ONLY-DISABLED | no repository backing |
| `roof` | DESIGN-ONLY-DISABLED | no repository backing |
| `stair` | DESIGN-ONLY-DISABLED | no repository backing |
| `railing` | DESIGN-ONLY-DISABLED | no repository backing |
| `furniture-component` | DESIGN-ONLY-DISABLED | no repository backing |

### Modify

| Tool ID | Classification | Current evidence / note |
| --- | --- | --- |
| `move` | DESIGN-ONLY-DISABLED | registry may describe partial/existing design coverage, but it is not in repository-backing list |
| `copy` | DESIGN-ONLY-DISABLED | no repository backing |
| `rotate` | DESIGN-ONLY-DISABLED | not in repository-backing list |
| `mirror` | DESIGN-ONLY-DISABLED | not in repository-backing list |
| `offset` | DESIGN-ONLY-DISABLED | not in repository-backing list |
| `align` | DESIGN-ONLY-DISABLED | not in repository-backing list |
| `trim` | DESIGN-ONLY-DISABLED | not in repository-backing list |
| `extend` | DESIGN-ONLY-DISABLED | not in repository-backing list |
| `join` | DESIGN-ONLY-DISABLED | not in repository-backing list |
| `split` | DESIGN-ONLY-DISABLED | no repository backing |
| `array` | DESIGN-ONLY-DISABLED | no repository backing |
| `delete` | DESIGN-ONLY-DISABLED | no repository backing as a tool ID; deletion in specific product contexts must not be inferred from this registry row |

### Annotate

| Tool ID | Classification | Current evidence / note |
| --- | --- | --- |
| `dimension` | DESIGN-ONLY-DISABLED | `tool-state.ts` explicitly calls out that an icon/rail slot is not an implementation |
| `text-note` | DESIGN-ONLY-DISABLED | no repository backing |
| `tag` | DESIGN-ONLY-DISABLED | no repository backing |
| `spot-elevation` | DESIGN-ONLY-DISABLED | no repository backing |
| `section-marker` | DESIGN-ONLY-DISABLED | no repository backing |
| `elevation-marker` | DESIGN-ONLY-DISABLED | no repository backing |

### Measure

| Tool ID | Classification | Current evidence / note |
| --- | --- | --- |
| `distance` | DESIGN-ONLY-DISABLED | no repository backing |
| `angle` | DESIGN-ONLY-DISABLED | no repository backing |
| `area` | DESIGN-ONLY-DISABLED | no repository backing |

### View

| Tool ID | Classification | Current evidence / note |
| --- | --- | --- |
| `pan` | PRODUCT-WIRED | Plan canvas has pan-tool behaviour plus middle/space/touch navigation |
| `orbit` | DESIGN-ONLY-DISABLED | 3D may have renderer navigation, but this registry tool ID has no declared repository backing |
| `zoom` | BACKED-BUT-UNWIRED | viewport zoom code exists and wheel/pinch is product-reachable, but current Plan active-tool contract does not list an armed `zoom` ID |
| `fit` | PRODUCT-WIRED | Plan canvas consumes active `fit`; palette, `F`, explicit view control and project-open path arm it |
| `perspective` | DESIGN-ONLY-DISABLED | registry command not backed |
| `orthographic` | DESIGN-ONLY-DISABLED | registry command not backed |
| `section-box` | DESIGN-ONLY-DISABLED | no repository backing |
| `hide` | DESIGN-ONLY-DISABLED | no repository backing |
| `isolate` | DESIGN-ONLY-DISABLED | no repository backing |
| `unhide` | DESIGN-ONLY-DISABLED | no repository backing |
| `view-style` | DESIGN-ONLY-DISABLED | no repository backing as a tool ID; current services-overlay control is a separate product control, not proof of this command |

### Review

| Tool ID | Classification | Current evidence / note |
| --- | --- | --- |
| `issue` | DESIGN-ONLY-DISABLED | no repository backing |
| `comment` | DESIGN-ONLY-DISABLED | no repository backing |
| `model-health` | DESIGN-ONLY-DISABLED | no repository backing |
| `compare-revisions` | DESIGN-ONLY-DISABLED | no repository backing |

### Tool totals at this audited head

- 54 registry tool IDs.
- 11 IDs have repository backing.
- 4 IDs have a clearly identified current active-tool product consumer: `select`, `wall`, `pan`, `fit`.
- 7 backed IDs are **not sufficient evidence of active-tool product reachability** and are currently at risk of appearing enabled because the rail gates on repository backing alone.
- 43 IDs are honestly disabled by the backing predicate when their group is visible.

This is a command/tool reachability finding, not a claim that the seven backed-but-unwired modules are useless. Several contain real algorithms that UX-3 is expected to wire into the product.

## 5. Tool-rail availability defect

`buildToolRailModel()` gets availability from `toolRailEntriesForMode()`, which gets `toolUnavailableReason()`. That function considers a tool available when:

1. the ID exists;
2. its group belongs to the active mode;
3. its ID is in `TOOLS_WITH_REPOSITORY_BACKING`.

It does **not** verify that the current product surface consumes the active tool ID.

Result: a module-backed tool can be rendered as enabled even when arming that ID does not produce a working user flow.

This must be resolved by UX-2/#420/#427 and the relevant UX-3 semantic/UI lane. The fix should not be to delete useful modules or hide future capability arbitrarily. The availability predicate needs a product-reachability/capability source that can distinguish `library_backed` from `user_reachable`.

## 6. Command palette inventory

The current product palette is a local `COMMAND_ENTRIES` constant in `App.tsx`, not generated from the tool/keyboard/command registries.

| Palette ID | Current classification | Notes |
| --- | --- | --- |
| `select` | reachable in Design/allowed modes, but palette lacks canonical availability metadata | dispatches `handleActivateTool` |
| `wall` | reachable in Design; can become silent no-op in modes where `activateTool` refuses it | palette itself does not display the mode-disabled reason |
| `door` | false-enabled / backed-but-unwired | arms ID, current Plan product path does not consume it |
| `room-boundary` | false-enabled / backed-but-unwired | same class as Door |
| `fit` | reachable | dispatches active tool and Plan consumes it |
| `close-tab` | conditionally effective but lacks disabled reason | palette item remains enabled even if current tab is not closeable; handler simply does nothing and still records demo action |
| `export-dxf` | hard-disabled placeholder | disabled reason is static `No project open yet`, so it remains disabled even when a project is open; no product export invocation here |
| `save-a-copy` | user-reachable when native project open | dynamic disabled reason; routes to actual copy/publication helper; terminology/authority still subject to #371 |
| `export-sheet-pdf` | user-reachable when plan content exists | dynamic disabled reason; routes to lazy sheet exporter |
| `publish` | user-reachable when writable native project open | dynamic reason; routes to actual Publish handler; final authority subject to #371 |

### Palette consistency defects

- Palette tool entries do not consume the same availability/disabled-reason contract as the tool rail.
- Palette contains only a hand-selected subset of tool IDs.
- Palette contains file/view commands that do not exist in one shared command registry.
- `close-tab` lacks context availability metadata.
- `export-dxf` uses a placeholder disabled reason rather than an actual capability gate.
- Tool palette actions can call `handleActivateTool`, have the underlying reducer refuse the action, and still record an apparent demo action.

These are direct inputs to #420 and #423.

## 7. Keyboard command contract vs product handling

`workspace-keyboard-map.json` contains 10 command contracts.

| Keyboard command | Registry binding | Product status at audited head |
| --- | --- | --- |
| `command-palette` | Cmd/Ctrl+K | implemented in App global handler |
| `save` | Cmd/Ctrl+S | **not handled by the audited App shortcut handler**; current persistence is journal/session driven, so the registry binding currently overstates a manual Save command |
| `undo` | Cmd/Ctrl+Z | implemented |
| `redo` | Shift+Cmd+Z; Windows says Ctrl+Y / Ctrl+Shift+Z | **partially implemented**: App handles Cmd/Ctrl+Shift+Z but not Ctrl+Y |
| `escape` | Esc | implemented with sheet-first then tool-cancel precedence |
| `select` | V | implemented |
| `wall` | W | implemented through `activateTool`; unavailable mode can still make it a silent no-op |
| `fit` | F | implemented |
| `focus-selection` | configurable/contextual F | **no dedicated product handler found in the audited global shortcut path** |
| `close-tab` | Cmd/Ctrl+W | implemented when active tab is closeable; otherwise browser/default behaviour is deliberately not prevented |

### Keyboard drift findings

- Registry documentation and actual shortcut handling have drifted for `save`, Windows `redo`, and `focus-selection`.
- Shortcut labels are already platform-resolved through the workspace keyboard contract, which should be preserved.
- #429 should consume the eventual canonical #420 command metadata instead of maintaining another local shortcut truth.

## 8. Top-bar and phone command surfaces

### Real product actions currently wired

- project overview;
- inline project rename (session/product state as currently implemented);
- undo;
- redo;
- open project;
- open command palette;
- view-kind switching;
- phone menu Publish when available;
- phone menu open/undo/redo/command search.

### Misleading or incomplete actions found

**Desktop TopBar Share**

`TopBar` always renders Share as an enabled native button. `App.tsx` supplies `onShare={() => recordDemoAction('share')}`. That is not a share implementation.

The phone menu is more honest: its Share row receives the collaboration capability disabled reason. Desktop and phone therefore disagree about the same capability.

**Desktop TopBar Account menu**

The Account button is active, but the host callback only records `open account menu`. No actual account menu flow is proven by this audit.

These controls must not be treated as verified product capabilities. UX-2/shell work should either route them to real governed capabilities or expose honest unavailable states.

## 9. Command-system package reality

`@arq/command-system` currently owns the drawing-command lifecycle state machine:

`armed -> previewing -> awaiting-input -> committed/failed-safely`

plus Escape/cancel rules and valid-preview-before-commit behaviour.

Its README explicitly says the palette lives in the design system and the keyboard map in workspace. Therefore the package name should **not** be interpreted as evidence that ARQ already has one global command metadata/dispatch authority.

#420 should extend/converge the current systems rather than assume such an authority already exists.

## 10. Mutating vs view/session commands

Current command families should be classified explicitly when #420 lands:

- **Semantic project mutation:** wall commits today, later door/window/room/dimension/note and other typed operations.
- **History mutation:** undo/redo apply operation inverses/forwards through current history path.
- **Project lifecycle/read:** open, working-copy persistence, Publish, save/download copy, export.
- **Document/export read:** PDF/DXF/other exports should not mutate project state.
- **View/session only:** select, pan, fit, zoom/camera, tab switching/close, panel/sheet state, command palette open.
- **Capability unavailable:** review/share/collaboration and design-only tools until their owning programme phases land.

No UI surface should infer this class independently once canonical command metadata exists.

## 11. Duplicate/dead/unreachable registration findings

### Duplicated command metadata

- tool IDs/names/groups in tool registry;
- repository backing in `tool-state.ts`;
- keyboard labels/bindings in keyboard registry;
- palette labels/categories/synonyms in `App.tsx`;
- top-bar and phone-menu labels/callbacks in `App.tsx`/components;
- availability logic spread across capability gates, tool backing and local dynamic conditions.

### Unreachable / placeholder command entries

- `export-dxf` palette entry is permanently placeholder-disabled in the audited product path.
- `save` keyboard command is registered but not handled.
- `focus-selection` keyboard command is registered but no dedicated handler was found.

### Backed-but-unwired tool IDs at risk of false enablement

- `window-select`
- `crossing-select`
- `selection-filter`
- `door`
- `window`
- `room-boundary`
- `zoom` as an armed tool ID

## 12. Required UX-2 consequences

### #420 canonical command metadata/dispatch

Must become the single shared source for at least:

- stable ID;
- label/category/synonyms;
- shortcut binding/label reference;
- product-reachability state;
- required mode/view/project context;
- disabled reason;
- mutating vs view-only/project-lifecycle classification;
- dispatch target;
- permission/capability gate;
- lazy feature boundary where applicable.

It should not load heavy feature modules just to build metadata.

### #423 palette/context menus

Must consume #420 metadata, including the exact same disabled reason as rail/button/shortcut paths.

### #427 tool lifecycle

Must distinguish “tool module exists” from “this product surface can currently arm and complete it”.

### #429 keyboard/focus

Must reconcile `save`, Windows redo, focus-selection and mode/context gating against canonical command metadata.

### UX-3 tool issues

#437/#441/#443 and later tool wiring must explicitly promote their tool IDs from `library_backed` to `user_reachable` only after the real Plan/product path and canonical operation are proven.

## 13. Suggested capability-ledger states for #370

Do not copy these blindly. #370 owns the actual schema and exact-head evidence.

- `select`: current/product-reachable.
- `wall`: current/product-reachable for the bounded plan path.
- `pan`: current/product-reachable.
- `fit`: current/product-reachable.
- `door`, `window`, `room-boundary`: library-backed / partial product wiring, not verified user-reachable authoring.
- `window-select`, `crossing-select`, `selection-filter`: library-backed interaction utilities, separate active-tool reachability unproven.
- `zoom`: product zoom interaction exists via wheel/pinch, but registry active-tool ID reachability is unproven.
- remaining 43 registry IDs: designed/planned or capability-gated according to their owning programme issues, not shipping claims.

## 14. Acceptance status for #398

### Satisfied by this audit

- all 54 tool registry IDs have a reachability classification;
- all palette entries have a current product classification;
- all keyboard registry commands have an implementation comparison;
- major top-bar/phone command surfaces have been checked for real vs placeholder behaviour;
- duplicate metadata authorities are identified;
- mutating/view/project-lifecycle boundaries are identified;
- false-enabled/backed-but-unwired tools are explicitly listed;
- UX-2 issues now have concrete drift to resolve.

### Still required before closing #398

- run the repository registry validation/check on the exact closing head;
- run focused real-product/browser evidence for representative enabled, disabled and false-enabled cases;
- refresh this audit if #361 or other active PRs materially change `App.tsx` command wiring before closure;
- feed the audited classifications into #370 without creating duplicate capability truth;
- after #420 lands, verify duplicate local metadata is actually retired or deliberately bounded.

## 15. ZEUS handoff

#369 should treat these as integration regressions if they survive UX-2:

- a tool enabled solely because a module exists while the current product surface cannot complete it;
- palette/rail/context menu/button showing different availability for the same command;
- registered shortcut labels that do not match actual handling;
- fake Share/Account actions presented as working capability;
- export/publish/save terms mapped to divergent lifecycle paths;
- local command descriptors reappearing after #420 establishes canonical metadata.

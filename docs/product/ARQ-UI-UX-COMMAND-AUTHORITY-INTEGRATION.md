# ARQ command authority integration contract

Issue: #420  
Base revalidated: `main @ c57f8353a0adf9130a33c1c23b8fffdefa5c5bf0`

## Canonical authority

`packages/workspace/src/product-command-authority.ts` is the product command/tool truth.

It is deliberately distinct from:

- the workspace design registries, which describe intended command/tool vocabulary;
- repository backing evidence, which only says implementation code exists somewhere;
- `@arq/command-system` lifecycle mechanics, which remain the command lifecycle authority;
- model/persistence authorities, which remain responsible for semantic mutation and durability.

A module existing in the monorepo never makes a command product-reachable.

## Ownership blockers at implementation time

Two live owners prevent safe root integration on this branch:

1. PR #504 owns `packages/workspace/src/index.ts`.
2. PR #361 owns `apps/web/src/App.tsx` and native session/persistence paths.

#420 must not race either owner.

## Required barrel integration after #504 serialises

After PR #504 merges or releases ownership, add exactly this export to `packages/workspace/src/index.ts`:

```ts
export * from './product-command-authority';
```

Do not move or copy the catalogue into `index.ts`.

## Required App integration after #361 serialises

After PR #361 merges or releases `apps/web/src/App.tsx`, rebase #420 and make App a consumer of the canonical authority.

### 1. Delete local command metadata

Delete App's local `COMMAND_ENTRIES` constant. Do not replace it with another App-local table.

Import the canonical helpers from `@arq/workspace`:

- `productEntriesForSurface`
- `dispatchProductCommand`
- `commandForShortcut`
- `resolveProductCommand`
- `type ProductCommandContext`

### 2. Build one runtime context from existing owners

App should derive one `ProductCommandContext` per render from state it already owns. Do not move those states into the command catalogue.

The context must include:

- `mode`: current workspace mode;
- `readOnly`: the real project/session read-only state;
- `activeCommandIds`: the active tool id when one is armed;
- `facts.canUndo`: current undo-stack truth;
- `facts.canRedo`: current redo-stack truth;
- `facts.canCloseActiveTab`: current tab contract truth;
- `facts.canSaveCopy`: current `saveCopyDisabledReason === undefined` truth;
- `facts.canExportSheetPdf`: current `exportSheetDisabledReason === undefined` truth;
- `facts.canPublish`: current `publishDisabledReason === undefined` truth;
- `capabilities`: only when an existing canonical capability owner supplies them.

Do not derive permission or security from whether a control is visible.

### 3. Command palette

Build palette entries from:

```ts
productEntriesForSurface('command-palette', commandContext, shortcutDialect)
```

Map `available === false` to the component's disabled state and pass `disabledReason` verbatim.

The following local special cases must disappear because their product truth is now canonical:

- Door must not be enabled merely because repository code exists.
- Room Boundary must not be enabled merely because repository code exists.
- DXF must report that it is not implemented, not merely "No project open yet".
- Focus Selection must remain unavailable until a dedicated execution path exists.
- shortcut labels must come from canonical metadata.

### 4. Dispatch

Palette, keyboard, top-bar and contextual surfaces should converge on `dispatchProductCommand` with adapters to existing App handlers.

Adapter responsibilities are intentionally thin:

- `activateTool(id)` -> existing workspace tool activation path;
- `runViewAction('open-command-palette')` -> existing palette open state;
- `runViewAction('cancel-current-tool')` -> existing Escape/tool cancellation path;
- `runViewAction('close-active-tab')` -> existing tab reducer path;
- `runHostAction('undo')` -> existing `handleUndo`;
- `runHostAction('redo')` -> existing `handleRedo`;
- `runHostAction('open-project')` -> existing file-open panel;
- `runHostAction('save-a-copy')` -> existing `handleSaveCopy`;
- `runHostAction('export-sheet-pdf')` -> existing `handleExportSheet`;
- `runHostAction('publish')` -> existing `handlePublishProject`.

Do not make the dispatcher own persistence or model state.

Wall activation remains a tool action. The descriptor's `semanticOperationId: 'add-walls'` records the semantic commit ultimately produced by the live wall path. The existing commit/journal owner remains responsible for applying and persisting that operation.

### 5. Keyboard

Keep the current IME/text-field guard, but use canonical command lookup for command identity and reachability.

Required truth:

- Save remains registered-but-not-wired. Do not advertise or fire Ctrl/Cmd+S until App has a real Save handler.
- Windows Redo is `Ctrl+Shift+Z`. Do not advertise `Ctrl+Y` while no live handler exists.
- Focus Selection remains registered-but-not-wired.
- Escape, Select, Wall, Fit, Undo, Redo, Close Tab and Command Palette remain represented through canonical metadata where their live paths exist.

### 6. Tool rail

The package-level migration is already complete: `toolRailEntriesForMode` and `activateTool` resolve through the canonical product authority.

App must pass the real read-only state when resolving/activating tools after #361 serialises. Do not reintroduce repository-backing checks in App.

### 7. Top bar

Share and Account currently call demo bookkeeping callbacks. They are represented as `registered-but-not-wired`, not as real capabilities.

After App migration, do not expose those demo callbacks as successful product commands. Either render the canonical disabled state or omit the surface according to the design-system component contract. Visibility is not permission enforcement.

Open Project and Publish have real host execution paths and can resolve from canonical metadata with their real context facts.

### 8. Contextual actions

Close Tab and Cancel Current Tool may use the same canonical descriptors and reasons. Do not create contextual copies of command availability logic.

### 9. Selection and zoom semantics

Do not create standalone product execution for:

- `window-select`
- `crossing-select`
- `selection-filter`
- `zoom`

Window/crossing marquee semantics currently execute under Select. Wheel/pinch zoom currently executes as direct viewport input. Those facts do not imply separate armed-tool reachability.

### 10. Missing CAD tools

Do not implement Door, Window, Room Boundary or any other missing CAD functionality in #420. Their descriptors remain honest until a later issue wires a real consumer and supplies execution evidence.

## #370 capability-ledger contract

#370 should consume the canonical descriptor fields rather than reconstructing reachability from modules or UI controls.

For each command/tool, record at least:

- `reachability`
- `libraryBacking`
- current resolved availability for the queried context
- `disabledReason`
- `effect`
- `persistence`
- `readOnlyBehaviour`
- `semanticOperationId`
- `capabilityRequirement`
- `evidenceOwner`

The ledger must keep `libraryBacking` and `reachability` separate.

## #369 reconciliation contract

The next #369 reconciliation after #420 lands must verify:

1. #504 added the public workspace export without duplicating the authority.
2. #361/App integration deleted `COMMAND_ENTRIES` rather than maintaining a second metadata table.
3. App surfaces derive availability from the same canonical resolver.
4. no repository-backed-only tool became armed/reachable.
5. Save and Windows Redo keyboard claims match live handlers.
6. Share/Account demo callbacks are not represented as product capabilities.
7. browser evidence covers palette, rail, keyboard, top bar and read-only behavior after root integration.
8. #370 capability state was refreshed from #420 descriptors and exact-head evidence.

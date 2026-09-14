# ARQ UI/UX overlay zone contract

**Issue:** #412  
**Parent:** #381  
**Input audit:** #403 / `docs/product/ARQ-UI-UX-TOKEN-LAYER-AUDIT.md`  
**Implementation base:** `main` @ `4184551be3e75636d7feea93fda13699b00b4b43`  
**Scope:** presentation layering, canvas overlay placement and pointer ownership only. No CAD hit-testing redesign.

## 1. Layer order

ARQ uses one ordered layer model. Local feature code must not create a competing large numeric z-index.

| Order | Surface | Authority |
| ---: | --- | --- |
| normal flow | base canvas and docked shell | layout / renderer |
| 10 | raised shell and passive view identity | `--arq-z-shell-raised` |
| 90 | context HUD, selection/tool chrome and centre transient canvas feedback | `--arq-z-context-hud` |
| 95 | workspace overlays: floating panels, tablet drawers and bottom sheets | `--arq-z-workspace-overlay` |
| 98 | focused accessibility escape surfaces such as the skip link | `--arq-z-accessibility` |
| 100 | modal backdrop | `--arq-z-overlay-backdrop` |
| 110 | modal surface | `--arq-z-overlay-surface` |
| 120 | menus and popovers | `--arq-z-popover` |
| 200 | toast/status notification | `--arq-z-toast` |

The workspace-local 95/98 tiers deliberately occupy the reserved gap between the HUD and modal backdrop. This gives three deterministic rules:

1. a drawer or sheet hides tool chrome where it physically covers the canvas;
2. a focused skip link remains visible above ordinary workspace overlays;
3. a modal backdrop still wins over all background workspace surfaces.

## 2. Canvas zones

`CanvasOverlayZone` defines the only named placement zones for new canvas chrome:

- `top-left`
- `top-center`
- `top-right`
- `bottom-left`
- `bottom-center`
- `bottom-right`
- `center`
- `selection`
- `tool`

Corner and centre zones use workspace safe-area variables instead of hard-coded edge offsets. `selection` and `tool` are full-canvas geometry hosts whose children own their exact geometry-derived position.

Reserved integration roles are:

| Role | Default zone | Pointer behavior |
| --- | --- | --- |
| view identity | top-left | transparent unless a real control is added |
| level selector | top-left | actual control bounds only |
| view controls | top-right | actual control bounds only |
| transient feedback | bottom-center | transparent by default |
| AI/review highlight | center | transparent by default |
| selection chrome | selection | actual control bounds only |
| tool HUD | tool | actual control bounds only |

These are presentation roles, not project state. A future feature may choose another named zone when evidence requires it, but it must not invent a private overlay coordinate system.

## 3. Pointer ownership

The canvas owns pointer input everywhere except the actual bounds of an interactive overlay control.

`arq-canvas-overlay-zone` is therefore always `pointer-events: none`. An interactive child opts back in with `arq-canvas-overlay-control`, which is `pointer-events: auto`.

The existing Context HUD follows the same rule independently: its host is pointer-transparent and the wall numeric input explicitly opts back in. This preserves snapping, pointer move and click ownership outside the field.

A full-screen transparent overlay container with pointer events enabled is forbidden. So is a transparent backdrop added only to make outside-click handling easier. Outside dismissal must not steal canvas input before the actual control receives it.

## 4. Current migrations

This issue migrates the current known collisions from #403:

- `WorkspaceSheet`: raw `zIndex: 5` -> `--arq-z-workspace-overlay`;
- desktop floating panels / tablet drawers: raised-shell tier -> workspace-overlay tier;
- `TabContextMenu`: raw `zIndex: 6` -> `--arq-z-popover`;
- phone project More menu: raw `zIndex: 6` -> `--arq-z-popover`;
- workspace skip link: runtime ordering -> named `--arq-z-accessibility` tier.

`data-arq-overlay-role` is attached to sheet/menu surfaces where practical so browser evidence can identify the semantic layer without inferring it from visual position.

## 5. Current conforming surfaces and explicit exceptions

### Conforming

- Plan tool Context HUD: HUD tier, pointer-transparent host, interactive numeric field only.
- modal infrastructure: named backdrop/surface tiers and React Aria modal behavior.
- passive view identity: raised-shell tier and pointer-transparent surface.
- refraction decoration: local z-index only and `pointer-events: none`.
- 3D canvas: no independent floating overlay system at this implementation head.

### Explicit exceptions routed elsewhere

- `apps/web/src/App.tsx` command-palette wrapper remains a transformed raw `zIndex: 10` stacking context while PR #361 owns that host file. #412 records the defect but does not mutate #361-owned code. After #361 releases the path, the wrapper must be removed or reconciled so modal children are not capped below global tiers.
- legacy `IPadLandscapeShell` raw z-index values remain tied to #396 consumer/legacy resolution rather than being mechanically promoted.

These exceptions are not permission for new code to copy their values.

## 6. Collision rules

When two surfaces want the same screen area, resolve the conflict in this order:

1. preserve semantic layer order;
2. move or flip geometry-anchored HUD/popover content when a positioning engine can do so without changing model state;
3. let a higher workspace surface occlude lower canvas chrome where the underlying canvas itself is covered;
4. collapse or relocate low-priority passive chrome on narrow canvases;
5. never fix a collision by adding a larger local z-index.

Menus/popovers are allowed to appear above sheets because they are transient descendants of a current interaction. Modal backdrop/surface outrank sheets and HUDs. Toasts remain last-resort notification chrome above all of them.

## 7. Safe areas, resize and drag

The zone host exposes top/right/bottom/left safe-area CSS variables with compact workspace spacing as the default. A platform host may override these variables when it owns a real reserved inset.

Panel resize and sheet drag remain presentation/session behavior. They must not write overlay coordinates into canonical project data. During resize/drag, avoid measuring or relaying out unrelated overlay zones on every pointer move. A sheet follows its existing detent/drag path; floating panels continue to publish their occupied width through the workspace layout contract.

## 8. Performance

The overlay contract adds no new blur, backdrop filter or animation. It uses layer ordering and pointer transparency only.

Existing material/filter cost remains owned by #402/#489. New overlay work must not add a full-viewport filtered surface merely to establish stacking or outside-click behavior.

## 9. Evidence contract

#412 closure evidence must include:

- unit/static evidence for layer ordering, named zones and pointer ownership;
- proof that raw sheet/menu z-index values are gone from their components;
- representative browser evidence for sheet/workspace layout and existing HUD/modal paths where the current Chromium harness supports them;
- explicit recording of the #361 `App.tsx` exception if it is still externally owned at closure.

Cross-engine completion is not invented here if the browser-matrix lane is still separate.

## 10. Rule for later features

Later level selectors, selection handles, Review Centre highlights, AI annotations and tool HUDs must choose a named zone and an existing semantic layer. If none fits, the feature must produce evidence for extending this contract before adding a new tier or full-canvas interaction surface.

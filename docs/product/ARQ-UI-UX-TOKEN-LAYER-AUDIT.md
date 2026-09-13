# ARQ UI/UX token and layer audit

**Issue:** #403  
**Programme:** #377  
**Phase:** UX-0  
**Audited integration head:** `main` @ `2d5a2ae73557049e0d5c2af01f6b0147942b1bcd`  
**Audit branch:** `codex/403-token-layer-audit-current-head`  
**Evidence:** exact-head repository inspection plus deterministic shell/workspace layer guard  
**Scope:** authority and migration audit only. No UX-1 overlay redesign and no broad restyle.

## 1. Integration and ownership boundary

Repository settings still name an older default branch, but current product integration authority is `main`: active product PRs target `main`, and the UI routing work uses it as the integration base. The audited exact head is therefore the `main` SHA above.

The move from the prior inspected SHA `14d333a225d6b606a8693f85246cacadb1c93ce3` to this exact head is one commit that only updates `docs/product/ARQ-UI-UX-WORKSPACE-OWNERSHIP-MAP.md`; no design-system, workspace implementation, shell token or `App.tsx` source changed in that interval. The implementation findings below therefore remain current at this head.

Fresh open-PR inspection found no active PR claiming `packages/design-system/src/**`. PR #361 remains the live owner of `apps/web/src/App.tsx` and native persistence/session paths. This audit inspects `App.tsx` where needed for layer evidence but does not mutate it.

The #396 workspace ownership map remains compatible with this audit:

- `WorkspaceRoot` is the current workspace composition authority;
- `@arq/workspace` owns responsive/panel/sheet presentation policy;
- `App.tsx` is the host integration surface and a serialised/high-conflict path while #361 is active;
- command palette, modal flows, command feedback and fixed host surfaces outside `WorkspaceRoot` still participate in the global layer contract.

## 2. Classification model

Every inspected visual value is classified as exactly one of:

1. **canonical token** - a shared semantic value already owned by the brand, shell or material system;
2. **justified local geometry/algorithm value** - a value whose meaning belongs to one component, viewport calculation, platform inset or interaction algorithm;
3. **migration candidate** - a repeated/shared semantic presentation value that should move onto an existing or deliberately introduced contract;
4. **invalid duplicate/ad hoc value** - a value that bypasses an already applicable named contract or creates an undocumented global layer relationship.

The audit does not use literal-count reduction as a goal.

## 3. Current authorities

### Brand and semantic colour

`design/tokens/brand.v4.css` is the brand/semantic colour authority. It supplies broad roles including focus, selection and active indication. It should not absorb shell dimensions or renderer geometry.

`packages/design-system/src/tokens.css` now only imports the brand token file. The previous audit's `--arq-z-modal: 400` compatibility finding is stale and has been removed from this audit. No legacy modal layer token exists there at the current head.

### Shell visual vocabulary

`packages/design-system/src/shell/shell-tokens.css` is the current shell token authority for:

- shell colours and materials;
- spacing on the 4 point grid;
- typography roles;
- control/menu/dialog/panel radii;
- 44px minimum touch target;
- focus treatment;
- shell layer tiers;
- overlay backdrop and shared shadows;
- motion durations and easing;
- dark/coarse-pointer adaptations.

`shell-controls.css` is the shared DOM control-state authority for normal, hover, pressed/active, primary, disabled, invalid and focus-visible states.

### Material and appearance

`packages/design-system/src/appearance/material.css` owns functional transparency. It contains opaque fallbacks for reduced transparency, increased contrast, forced colours, print and unsupported backdrop filtering. Nested material explicitly disables the second backdrop filter and shadow.

## 4. Exact current layer hierarchy

The named global scale is coherent:

<!-- prettier-ignore -->
| Layer | Current authority | Value / behaviour | Classification |
| --- | --- | --- | --- |
| base canvas | renderer/content flow | no global named z tier | 2 |
| docked shell | normal layout flow | no global z escalation | 2 |
| raised/floating shell | `--arq-z-shell-raised` | 10 | 1 |
| accessibility skip link | `workspace-shell.css` | raw `z-index: 20` | 3 |
| context HUD | `--arq-z-context-hud` | 90 | 1 |
| modal backdrop | `--arq-z-overlay-backdrop` | 100 | 1 |
| modal surface | `--arq-z-overlay-surface` | 110 | 1 |
| menu/popover | `--arq-z-popover` | 120 | 1 |
| toast/status notification | `--arq-z-toast` | 200 | 1 |
| canvas-local transient decoration | renderer/local stacking | local only, must not become a global escalation path | 2 |

Current component exceptions and collisions:

<!-- prettier-ignore -->
| Surface | Current value | Classification | Consequence / owner |
| --- | ---: | --- | --- |
| `WorkspaceSheet` | `zIndex: 5` | 4 | below raised shell with no named sheet relationship; #412 owns migration |
| `TabContextMenu` | `zIndex: 6` | 4 | a menu bypasses the existing popover tier and can sit below raised shell; #412 |
| phone project-bar More menu | `zIndex: 6` | 4 | same menu-layer defect; #412 |
| workspace skip link | `z-index: 20` | 3 | accessibility ordering is intentional but unnamed; #412 should make relationship explicit without lowering accessibility |
| refraction lens pseudo-element | `z-index: 1`, `pointer-events: none` | 2 | local optical decoration, not a global overlay tier |
| legacy `IPadLandscapeShell` floats | three `zIndex: 1` values | 4 | library-only/legacy candidate per #396; resolve with consumer/cleanup authority rather than escalating |
| `App.tsx` command-palette wrapper | fixed/transformed `zIndex: 10` | 4 | transformed parent can trap the modal stacking context below HUD/modal/popover tiers; inspect-only until #361 releases `App.tsx`, then #412 must remove or reconcile it |

### Bottom sheet/drawer relationship

Current floating left/right workspace drawers already use `--arq-z-shell-raised`. The touch `WorkspaceSheet` uses raw 5. Therefore a raised drawer can currently outrank the sheet. That is a real collision, not a reason to invent `9999` or mechanically raise every surface.

The correct UX-1 action is for #412 to decide the semantic sheet/drawer ordering and express it with the canonical layer contract.

### Menu relationship

Both audited workspace menus use raw 6 even though `--arq-z-popover: 120` already exists. These are invalid duplicates rather than merely local geometry because the semantic role is already named. They should not survive #412.

### Modal and pointer behaviour

`modal-dialog.css` consumes the canonical backdrop/surface tiers. `ArqModalDialog` is built on React Aria modal primitives, which provide focus containment, background inertness and Escape/outside-dismiss semantics. This is stronger evidence than screenshot ordering alone.

The workspace menus add Escape and outside-pointer dismissal. Their low raw z values can still create visual/pointer confusion if another raised surface visually covers them while the document-level outside-pointer handler remains active. #412 should test overlapping states, not only isolated menus.

Decorative refraction pseudo-elements use `pointer-events: none`, avoiding accidental hit interception.

## 5. Token and local-value classification by visual domain

<!-- prettier-ignore -->
| Domain | Current classification | Audit result |
| --- | --- | --- |
| spacing | 1 for shared shell rhythm, 2 for measured one-off geometry | shell 4pt vocabulary is canonical; do not tokenise every gap |
| control dimensions | 1 for shared controls/touch target, 2 for measured layout reserves | 44px target is canonical; component-specific widths may remain local |
| typography | 1 for named shell roles, 3 for repeated inline semantic roles | do not migrate arbitrary text sizes unless they represent an existing/shared role |
| icon sizes | 1 where control/icon contract already defines them, otherwise 2 | no evidence justifies a new global icon-size family from this audit alone |
| radii | 1 for control/menu/dialog/panel families | new shell chrome should consume existing semantic radii |
| borders | 1 for shared shell line/focus/error vocabulary | one-off geometry borders may remain component-local when role differs |
| panel dimensions | 2 when responsive/measured, 3 only when the same semantic dimension repeats | keep policy in `@arq/workspace` |
| focus rings | 1 | existing focus semantic/token contract is canonical |
| selection / active tool | 1 where brand/shell semantic states already exist; 3 for future shared interaction-state gaps | interaction owner defines semantics before new colour tokens |
| hover / pressed | 1 | `shell-controls.css` authority |
| disabled | 1 | `shell-controls.css` authority |
| warning / error / invalid | 1 for existing DOM shell error/invalid semantics; 3 for programme states not yet standardised | do not invent severity colours ahead of owning state contracts |
| snap feedback | 2/3 | renderer/interaction semantics must define state first; no new token family proven here |
| drag state | 2/3 | direct-manipulation geometry remains local until shared semantics exist |
| touch targets | 1 | `--arq-touch-target-min: 44px` |
| shadows | 1 for shared menu/overlay elevation, 2 for distinct optical/local affordances, 3 for reusable sheet elevation | direction/purpose matters; do not collapse all shadows to one value |
| backdrop/filter | 1 only through `material.css` | no feature-local backdrop filters should be added |
| motion duration/easing | 1 for canonical shell vocabulary, 4 when code references non-canonical token names | final programme reconciliation remains #486 |
| z-index/layering | 1 for named tiers, 4 for semantic overlays using raw numbers, 2 for truly local stacking | guarded by a narrowly scoped static test |
| safe-area | 2 | `env(safe-area-inset-top, 0px)` in phone project chrome is platform geometry, not a numeric design token |

## 6. High-value migration candidates

### #412 overlay/layer work

1. Replace `WorkspaceSheet` raw layer 5 with an explicit sheet/drawer relationship in the canonical layer contract.
2. Move `TabContextMenu` and the phone project-bar menu to the named popover/menu tier.
3. Reconcile the skip-link layer while preserving its accessibility requirement to become visible above ordinary shell chrome.
4. After #361 releases `App.tsx`, remove or reconcile the transformed `zIndex: 10` command-palette wrapper so it cannot create a modal stacking-context ceiling.
5. Resolve or retire raw layer values in the legacy iPad shell only after #396 consumer evidence establishes its status.
6. Exercise overlapping menu, sheet, drawer, HUD, modal and toast states for pointer hit/occlusion behaviour.

### Token/chrome migrations

`WorkspaceSheet` also carries a local upward shadow, `0 -4px 16px rgb(0 0 0 / 18%)`. It is a class 3 candidate if touch sheets/drawers need a reusable elevation role. It should not simply reuse the menu shadow because direction and semantic elevation differ.

Local `width: 480` in the command palette and similar measured component widths remain class 2 unless another surface proves a shared compact-dialog size family.

## 7. Justified local exceptions

Keep these local unless their semantics change:

- responsive breakpoints and orientation/pointer thresholds in `@arq/workspace`;
- sheet detent, viewport-height and drag calculations;
- renderer hit tolerances, snap distances and geometry coordinates;
- safe-area `env(...)` values;
- local optical lens stacking at 1 while `pointer-events: none` keeps it non-interactive;
- measured component widths/reserve sizes that are not a repeated semantic family;
- distinct one-off selection/status shadows when they communicate a component-specific affordance rather than global elevation.

These values are not defects merely because they are numeric.

## 8. Motion and reduced-motion evidence

Verified current patterns:

- modal entry/exit transition rules only exist under `prefers-reduced-motion: no-preference`;
- skip-link movement is likewise gated by `no-preference`;
- refraction-lens movement is explicitly disabled under `prefers-reduced-motion: reduce`.

A drift remains in `workspace-shell.css`: the lens transition references `--arq-motion-duration-fast` and `--arq-motion-ease-standard` with local fallbacks, while the canonical shell vocabulary is `--arq-motion-fast` and `--arq-ease-standard`. This is class 4 token-name drift. #486 should reconcile it as part of the final programme motion pass, or a bounded pre-#486 correction may switch it directly to the canonical names if ownership is clear.

This issue does **not** claim comprehensive reduced-motion completion. #486 remains the final reconciliation authority.

## 9. Material and compositing performance follow-up

The material system is bounded but not free:

- regular material uses `saturate(165%) blur(28px)`;
- strong material uses `saturate(165%) blur(34px)`;
- optical material uses `blur(16px) saturate(1.06)`;
- optical material also carries a multi-layer shadow.

Mitigations already present include `contain: paint`, opaque accessibility/platform fallbacks and explicit suppression of nested material blur/shadow.

No effect is removed by this audit based on taste. #402/#489 must measure material/filter cost, sheet-open cost, compositing and interaction latency on the actual hot paths. Broad UX work should not expand backdrop filtering to docked/full-viewport surfaces without evidence.

## 10. Deterministic drift check

`packages/design-system/src/shell/layer-contract.test.ts` scans only `packages/design-system/src/shell/**` and `workspace/**` source files for raw numeric `z-index`/`zIndex` declarations.

It intentionally:

- ignores renderer/geometry packages;
- ignores token declarations and named `var(...)` uses;
- keeps an explicit audited allowlist of current raw exceptions;
- treats the allowlist as debt visibility, not approval;
- fails when a new raw shell/workspace layer constant appears without an audit update.

The check therefore prevents new `9999`-style drift without flagging valid layout numbers.

`App.tsx` is not included in the guard while #361 owns that high-conflict host file. Its current raw command-palette wrapper is nevertheless recorded above as an exact #412 input.

## 11. Evidence status and closing requirements

Verified by exact-head source inspection:

- canonical token authorities and current shell layer tiers;
- modal use of backdrop/surface tiers;
- current workspace raw layer exceptions;
- current command-palette host stacking-context risk;
- pointer-event suppression on decorative lens surfaces;
- safe-area use in phone chrome;
- modal, skip-link and lens reduced-motion patterns;
- material fallbacks and nested-filter suppression;
- stale legacy `--arq-z-modal` finding removed.

Executable evidence must be attached to #403/its PR before closure:

- focused Vitest/design-system evidence including the new layer-contract guard;
- existing appearance/contrast tests;
- repository CI/type evidence as applicable to the changed files.

Representative browser overlay checks are desirable where an integrated browser harness exists. The cross-engine browser-matrix work is still an open PR (#363), so this audit must not invent browser evidence from that unmerged lane. If no current-head browser harness executes the representative overlay states, record browser evidence as blocked/not run rather than treating screenshots as proof.

The requested ZEUS compile invocation is also recorded as blocked/not run in connector-only execution unless an actual runner executes it.

## 12. Inputs now fixed for #412

#412 may treat the following as current exact-head input:

- global named order: raised shell 10, HUD 90, modal backdrop 100, modal surface 110, popover 120, toast 200;
- base canvas/docked shell stay outside global z escalation by default;
- `WorkspaceSheet` raw 5 is invalid global-layer drift;
- workspace menu raw 6 values are invalid duplicates of the popover semantic role;
- skip-link raw 20 is an accessibility-sensitive migration candidate;
- local refraction z1 is justified and non-interactive;
- legacy iPad z1 values are lower-priority debt tied to #396 consumer status;
- `App.tsx` command-palette fixed/transformed z10 wrapper is a high-priority stacking-context risk that cannot be edited until #361 releases the host path;
- modal infrastructure itself already owns focus containment/background inertness and canonical backdrop/surface tiers;
- pointer tests must cover overlapping drawer/sheet/menu/HUD/modal/toast states, not isolated screenshots;
- no arbitrary z escalation is acceptable as a fix.

## 13. Routing

- #412 owns layer-zone migration, collision removal and pointer/occlusion reconciliation.
- #486 owns final reduced-motion reconciliation and should consume the refraction token-name drift.
- #402/#489 own measurement and enforcement for blur, large shadows, compositing and animated-layout hot paths.
- #396 should retain `App.tsx` as serialised/high-conflict until #361 releases it and may use this audit's outside-`WorkspaceRoot` overlay findings.
- #369 should treat new unclassified shell/workspace raw z values, a second motion/focus/touch vocabulary, or unmeasured expansion of heavy materials as routing regressions.

## 14. Closure rule

#403 may close only when the exact-head audit is repository-visible, the deterministic layer guard passes, focused design-system evidence passes, and the final issue comment records any browser/ZEUS evidence that is unavailable as blocked rather than verified.

Closing #403 does not mean #412, #486 or #489 are complete. It means those implementation lanes have a deterministic current contract and a bounded list of remaining migrations.

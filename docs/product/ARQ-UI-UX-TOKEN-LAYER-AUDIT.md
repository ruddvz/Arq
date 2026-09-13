# ARQ UI/UX token and layer audit

**Issue:** #403  
**Programme:** #377  
**Phase:** UX-0  
**Audited branch/head:** `main` @ `933771396e7f9ede1548212c798665520a04b957`  
**Evidence type:** static design-system and shell inspection  
**Status:** current audit, not visual-regression or performance proof

## 1. Purpose

This audit separates three classes of values:

1. canonical shared visual tokens that UI work should consume;
2. justified local values that express algorithm, geometry or measured interaction behaviour and should not be forced into a visual token system;
3. duplicated or ad hoc presentation constants that should be consolidated before UX-1 adds more shell chrome.

The goal is not to tokenise every number. It is to prevent spacing, radius, focus, touch, motion and stacking systems from forking across features.

## 2. Current token authority is layered, not singular

### Brand colour source

`design/tokens/brand.v4.css` is the generated brand/semantic colour source consumed through `packages/design-system/src/tokens.css`.

It should remain focused on brand and broad semantic colour identity rather than shell geometry.

### Shell visual vocabulary

`packages/design-system/src/shell/shell-tokens.css` is the effective editor-shell token authority. It currently owns or defines the shared vocabulary for:

- UI surfaces, linework and text;
- plan fills/material colours;
- typography and font families;
- spacing based on the 4 point grid;
- control/menu/dialog/panel radii;
- minimum touch target size;
- focus ring;
- overlay z-index tiers;
- overlay backdrop;
- floating shadows;
- motion durations and easing;
- light/dark/coarse-pointer adaptations.

This is a legitimate shell-specific layer and should be extended deliberately rather than replaced with unrelated local constants.

### Material layer

`packages/design-system/src/appearance/material.css` owns the one approved functional transparency/backdrop material system. It already contains opaque fallbacks for reduced transparency, increased contrast, forced colours, printing and browsers without backdrop-filter support.

This is not a second generic colour system. It is an opt-in floating-surface treatment with a defined fallback contract.

## 3. Existing shared interaction tokens are useful and should be preserved

Current shell tokens already cover high-value programme requirements:

- `--arq-touch-target-min: 44px`;
- shared focus ring;
- shared spacing values;
- shared control/menu/dialog/panel radii;
- shared overlay tiers;
- motion durations including instant, micro, fast, normal and deliberate;
- separate standard, enter and exit easing curves.

`shell-controls.css` already centralises default, hover, active/pressed, primary, disabled, invalid and focus-visible shell control behaviour.

Later UX work should consume these systems before inventing local equivalents.

## 4. Overlay and z-index inventory

The current shell token scale defines these meaningful tiers:

| Token | Value | Intended class |
| --- | ---: | --- |
| `--arq-z-shell-raised` | 10 | raised shell/chrome |
| `--arq-z-context-hud` | 90 | contextual HUD/tool feedback |
| `--arq-z-overlay-backdrop` | 100 | modal/review backdrop |
| `--arq-z-overlay-surface` | 110 | modal/review surface |
| `--arq-z-popover` | 120 | popovers/menus above overlays where allowed |
| `--arq-z-toast` | 200 | transient topmost status |

`modal-dialog.css` correctly consumes `--arq-z-overlay-backdrop` and `--arq-z-overlay-surface`.

### Layer drift found

`packages/design-system/src/workspace/workspace-sheet.tsx` uses a literal `zIndex: 5`.

That value is below the named shell raised tier and has no documented relationship to modal, HUD, popover or toast layers. It is a direct #412 migration candidate.

`packages/design-system/src/tokens.css` also defines `--arq-z-modal: 400` while the current modal component consumes the newer overlay backdrop/surface tokens from `shell-tokens.css`. In the inspected modal path this compatibility value is not the active modal authority. Before deleting it, run a full consumer search because code search can be incomplete. It should not be used by new UI.

## 5. Shadow drift found

The shell token layer already defines shared menu and overlay shadows.

However, `workspace-sheet.tsx` uses the local literal:

`0 -4px 16px rgb(0 0 0 / 18%)`

The large desktop workspace CSS also contains local shadows for the floating status pill and selected view segment.

Not every shadow needs the same token, because direction and visual purpose can differ. The rule should be:

- repeated/floating-layer language gets a named token;
- one-off optical details remain local only when their distinct semantic purpose is documented;
- no future component adds a new arbitrary shadow merely for decoration.

The touch sheet shadow is a high-confidence token/migration candidate because it represents a reusable elevation layer.

## 6. Geometry and responsive constants that should not be blindly tokenised

Several numeric values are correctly owned by algorithms or layout policy rather than CSS tokens.

Examples:

- `TopBar` measured-layout constants such as reserve width and overflow-button width;
- responsive width/orientation/pointer thresholds in `@arq/workspace`;
- sheet detent calculations and viewport-dependent heights;
- renderer hit tolerances, geometry coordinates and snap distances;
- benchmark thresholds and performance budgets owned by #402.

A visual-token audit must not move these values into CSS just to reduce literal counts. Their authority is code behaviour, not theme styling.

## 7. Local presentation constants that are migration candidates

### Workspace sheet

`workspace-sheet.tsx` currently contains inline presentation values for:

- layer value `zIndex: 5`;
- sheet shadow literal;
- `h2` size `1rem`;
- structural borders/background/radii expressed inline even where tokens exist.

Its height itself is correctly derived from `@arq/workspace` sheet-detent policy and should remain there.

Recommendation: move reusable sheet chrome into a sheet CSS/module contract consuming named shell tokens while keeping pointer/height behaviour in TypeScript.

### Command palette

`command-palette.tsx` uses the shared modal boundary and most shared shell tokens, which is good. It still has local layout values such as `width: 480` and inline structural styling.

That width is not automatically a token defect. If command/search panels, future quick-open surfaces and Review Centre share a compact-dialog width family, introduce a named size token. Otherwise keep one well-documented component-local value.

### Desktop workspace polish

`workspace-shell.css` contains carefully justified one-off values such as very small segmented-control gaps and local optical shadows. Do not migrate them mechanically.

High-value migrations are values that represent shared shell dimensions/elevation/state. Low-value migrations are numeric details whose reason exists only inside one control.

## 8. Focus and accessibility state vocabulary

Current strong foundations:

- shared `:focus-visible` ring in `shell-controls.css`;
- modal descendants reuse the shared ring;
- minimum 44px touch target token;
- active/pressed state has fill plus semantic `aria-pressed`, not colour alone;
- invalid controls require visible caller text in addition to border treatment;
- disabled controls remain legible.

UX-1/UX-2 must preserve these rather than styling focus independently per component.

Potential drift to audit during implementation:

- custom canvas/renderer handles that do not use DOM control tokens;
- direct manipulation handles on tablet that need larger touch geometry;
- selected state that relies only on opacity/tint;
- popovers/tooltips opened only on hover.

#484 remains the final accessibility reconciliation authority.

## 9. Motion vocabulary and reduced-motion status

The token layer already defines a restrained motion vocabulary and comments explicitly prohibit `transition: all`, decorative bounce and ambient editor motion.

`modal-dialog.css` correctly gates entry/exit animation behind:

`@media (prefers-reduced-motion: no-preference)`

so the modal becomes effectively unanimated when the user requests reduced motion.

This is evidence of the correct pattern, not proof that every animated component follows it.

#486 should inventory all actual transitions after UX-1 through UX-7 and enforce the same rule globally. It should not create a second motion token set.

## 10. Material/transparency performance risk

`material.css` is intentionally bounded and includes strong fallback behaviour. However, its current filters are not cheap:

- regular material: `saturate(165%) blur(28px)`;
- strong material: `saturate(165%) blur(34px)`;
- optical material: `blur(16px) saturate(1.06)`.

The file already prevents nested material blur and uses `contain: paint`, which is good.

The UI/UX programme should not remove the material layer merely because blur can be expensive. Instead:

- #489/#402 must measure the visible surfaces that use it;
- #488 must keep an honest fallback when renderer/GPU conditions are poor where relevant;
- broad shell work must not add backdrop material to docked/full-viewport surfaces;
- an opaque background must not sit on top of a backdrop filter and pay GPU cost for no visible effect.

## 11. State token coverage

Current shared shell state coverage is strongest for normal DOM controls:

- default;
- hover;
- focus;
- active/pressed;
- primary action;
- disabled;
- invalid/error.

Programme states that still need explicit shared treatment or evidence as features land:

- semantic selection versus primary selection versus hover;
- drag/active-handle state;
- snap target/type state;
- read-only/capability-disabled with reason;
- warning versus blocking error;
- Agent proposal preview versus committed selection;
- hidden/off-level selected state;
- persistence/recovery status.

Do not add a colour token first and decide semantics later. The owning interaction/state contract should define the state, then the design system should provide the visual vocabulary.

## 12. Recommended token/layer actions before broad UX-1 polish

### High priority

1. Treat `shell-tokens.css` overlay scale as canonical for new UI.
2. Migrate `WorkspaceSheet` away from literal `zIndex: 5` into the #412 layer contract.
3. Give reusable touch-sheet elevation a named token if the existing overlay/menu shadows do not semantically fit.
4. Include CommandPalette, modal dialogs, file-open flows, command feedback, tool HUD, level selector and future Review Centre in the #412 collision map.
5. Preserve shared focus/touch tokens across new shell controls.

### Medium priority

6. Audit local inline shell dimensions only when multiple components repeat the same semantic dimension.
7. Remove or formally alias the old `--arq-z-modal` compatibility variable only after a complete consumer search.
8. Move heavy reusable visual chrome from inline style objects into named component CSS where that improves state/media-query control.

### Evidence work

9. Measure material/filter cost under #402/#489.
10. Let #486 perform the final reduced-motion inventory after animated programme surfaces exist.
11. Let #487 provide visual-regression evidence for token migrations instead of updating baselines blindly.

## 13. No-go migrations

Do not:

- move renderer/geometry tolerances into visual tokens;
- move responsive behavioural policy out of `@arq/workspace` merely because it contains pixel values;
- create a second motion vocabulary for one feature;
- add local `z-index: 9999` style escalation;
- duplicate focus ring/touch target rules in feature components;
- replace all local constants with tokens without a shared semantic reason;
- use a token name to make an unresolved product state look standardised.

## 14. Acceptance status for #403

### Satisfied by this static audit

- current brand, shell, interaction and material token authorities are separated;
- named overlay tiers are identified;
- literal touch-sheet layer/shadow drift is identified;
- focus/touch/motion foundations are documented;
- high-cost material effects and fallback behaviour are documented;
- justified algorithm/responsive constants are separated from migration candidates;
- #412/#486/#489 have concrete input.

### Still required before closing #403

- run a complete exact-head consumer search for old/duplicate z-index variables;
- run or link visual-regression evidence for representative shell states;
- verify colour/focus/state contrast through the existing design-system tests at the closing head;
- refresh if active UI PRs introduce new local layer or shell constants;
- if practical, add a narrow lint/check after the accepted layer contract exists rather than before the contract is settled.

## 15. ZEUS handoff

#369 should flag these as token/layer regressions:

- new arbitrary z-index escalation outside #412's named tiers;
- a second touch/focus/motion vocabulary;
- repeated shared shell dimension literals after a canonical token exists;
- expensive material effects added to large/docked surfaces without measurement;
- visual-baseline updates used to hide layout/state regressions;
- colour-only critical state after migration.

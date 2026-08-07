# ARQ Version 12 implementation ledger

A resumable task ledger for the Version 12 implementation, and nothing more. It
does not decide lanes, gates or evidence sufficiency: ZEUS
(`.zeus/FAST-KERNEL.md`) routes the work and Engineering OS (`engineering/`)
remains the merge authority. Where this file and either of those disagree, they
win.

**Branch:** `claude/arq-liquid-glass-12-5gstys`
**Base:** `claude/arq-cad-platform-research-ba8rav` (this repository's default)
**Pull request:** ruddvz/Arq#303
**Evidence revision:** `0f14f8e`
**Delivery stop:** pull request plus verified preview. Not merge, not production.

## States

`not-started` · `partial` · `implemented` (built, focused tests pass) ·
`verified` (built, tested, and observed running at the required viewports) ·
`blocked` (external, with the owner action named).

Only `verified` is green.

## Standing evidence

At `0f14f8e`, uncached: 3,566 tests across 331 files; `pnpm typecheck` (37
packages); `lint`; `format:check`; `check:editor-dependency-boundaries`;
`check:dependency-licences`; `zeus-guard-test`; the language ladder through
`arq:language:audit:ci`. All fifteen headless-Chromium capability checks pass -
run locally because **GitHub Actions has produced no run for this pull request**
across every push so far (all eight workflows report `state: active`; nothing
has run repository-wide since ~10 minutes before the PR opened). Every claim
below is therefore local evidence, not a green pipeline.

Two standing external blockers, neither of which any amount of implementation
clears:

1. **No CI run exists.** The pattern points at repository-level run approval or
   billing, which is an owner action.
2. **No preview exists for `apps/web`.** Vercel builds `arq-website`, the
   marketing site, and nothing else. The delivery stop asks for a verified
   preview against the exact pull-request head, and for the code this change
   touches there is no preview to verify. The nearest available substitute is
   the local headless-Chromium evidence recorded per row.

## Responsive evidence at `10862c5`

Captured directly from the running application, with the golden fixture opened
through the real file dialog, at the four required viewport classes. Each was
asserted in-page rather than eyeballed: no "demo fixture" string, no "Fixture
wall" string, and zero horizontal overflow at every size.

| Viewport  | Band resolved      | Canvas   | Fixture opens                   |
| --------- | ------------------ | -------- | ------------------------------- |
| 1600x1000 | `desktop`          | 1380x776 | yes                             |
| 1366x1024 | `desktop`          | 1180x847 | yes                             |
| 1024x768  | `tablet-landscape` | 1008x572 | yes                             |
| 430x932   | `phone`            | 414x740  | **no - no Open control exists** |

Two findings from this run, both recorded against their rows:

- **A 1366px iPad resolves to the `desktop` band**, not a tablet one, because
  `resolveWorkspacePlatform` only treats a coarse pointer as a tablet below
  1280px. It gets touch sizing from the `pointer: coarse` rules but the desktop
  composition. Row 9.
- **A first pass recorded "the phone cannot open a project at all". That was
  wrong**, and the error was in the harness rather than the product: it looked
  for a control named "Open", which is the desktop label, and concluded the
  affordance did not exist. The phone opens a project through "Back to
  projects", and driving that path opens the golden fixture and renders it -
  captured. What is genuinely missing is a recent-projects surface, which
  section 11 also requires. Row 10 and row 11.

## Known defect carried across every row

The application's **default state is still partly demo content**: project name
"Untitled project", a hard-coded 4.20 x 3.60 demo room on the canvas, and two
invented tree rows ("Interior Wall 100mm", "Room 4.20 x 3.60"). Opening the
golden fixture replaces all of it with canonical data ("Courtyard House
Reference · revision 191", real levels, walls, rooms), but the default screen is
what a reader sees first and it is not product truth.

Removed at `b5b2d97`+1: the 5,000 synthetic `Fixture wall N` rows that dominated
the first screen of every session. They were justified as "the only way this
build can exercise the virtualiser", which was not true - `visibleModelTreeRows`
has its own unit test that windows a tree without rendering anything and without
shipping the rows to a reader.

Tracked as row 11's remaining work and treated as blocking `verified` on rows 4,
5, 7 and 11.

---

## 1. Repository mapping and token reconciliation

**State:** implemented
**Owner:** `packages/design-system/src/shell/shell-tokens.css`,
`design/tokens/brand.v4.css`, `packages/design-system/src/appearance/`
**Done:** `--arq-ui-canvas` separated from `--arq-ui-paper`; the operating-system
font stack and the Version 12 desktop type scale, with a `pointer: coarse`
override so touch never inherits 11px body; tabular figures on numeric readouts;
`--arq-radius-panel`. ADR-0031 and ADR-0032 record the two supersessions of
blueprint sections 14 and 15, each with a working rollback.
**Remaining:** none identified.
**Evidence:** `appearance-policy.test.ts`, `dark-appearance.test.ts`; screenshots
at four viewport classes.
**Blockers:** none. **Rollback:** revert the token block; `APPEARANCE_POLICY`
flags restore the pre-ADR reading and the guards enforce it.

## 2. Imported icon adapter and semantic mapping

**State:** partial
**Owner:** `design/icons/svg/`, `packages/icons/`, `apps/web/src/tool-icons.tsx`
**Done:** eight tool-group glyphs drawn in the house style and generated through
the repository pipeline (48 components, one family, no dependency); the rail
renders as a 48px dock with labels as accessible names; `TOOLS_AWAITING_ICON`
plus a test that fails three ways makes the gap a decision rather than a silence.
**Remaining:** 24 of 54 registry tools still have no glyph and render as text
rows inside an expanded group.
**Evidence:** `tool-icons.test.ts`; `check:workspace-registries` reports 48/215.
**Blockers:** none - these are drawable in the same style.
**Rollback:** delete the eight SVGs, regenerate, drop `categoryIcons`.

## 3. Liquid Glass functional surface and fallbacks

**State:** implemented
**Owner:** `packages/design-system/src/appearance/material.css`
**Done:** one bounded material; regular and strong variants at the contract's
blur and saturation; no `clear` variant; nesting defeated by
`.arq-material .arq-material`; four mandatory opaque fallbacks (reduced
transparency, increased contrast, forced colours, no `backdrop-filter`);
`prefers-reduced-transparency` read in `display-preferences.ts`.
**Remaining:** applied to four floating surfaces only; the dock, project bar and
status pill are opaque cards rather than material.
**Evidence:** `appearance-policy.test.ts` enforces single-owner, no-nesting,
all-fallbacks and no-material-on-content.
**Blockers:** none. **Rollback:** flip the policy flag; the guard then fails
until the implementation is gone.

## 4. Desktop idle workspace and stable viewport

**State:** partial
**Owner:** `packages/design-system/src/workspace/workspace-root.tsx`,
`packages/editor-shell/src/viewport-controller.ts`
**Done:** canvas-first composition - the drawing runs 1228px of 1600 (was 640)
with both panels floating over it; `reconcileDockedPanels` gained a
`composition` input, default unchanged; `preserveWorldUnderViewportRect` holds
the page-pixel-to-world mapping across a resize, property-tested in both
directions; the idle context strip no longer reserves 38px.
**Remaining:** the default screen still shows demo content (see above); the mode
rail is a 112px text column the reference does not have; no Version 12 view
header on the drawing.
**Evidence:** `viewport-controller.test.ts`; `benchmark:workspace-layout` 8/8
viewports.
**Blockers:** none. **Rollback:** drop the `composition` argument at the call
site; `'docked'` is the default.

## 5. Selection and Inspector

**State:** partial
**Owner:** `packages/design-system/src/shell/inspector-groups.ts`,
`apps/web/src/inspector-data.ts`
**Done:** `mergeInspectorFields` collapses a multi-selection - a property
survives only when every element agrees on value _and_ state, anything else
becomes `mixed`; editability derived per row so a mixed row over calculated
values offers no edit; history dropped and warnings unioned; the screen-reader
description reports the selection rather than naming one member as the whole.
**Remaining:** Inspector is not contextual (doc 09 wants it absent until
selection or active command) - needs the user-pin concept first; overlap cycling
and selection-filter routes unverified.
**Evidence:** `merge-inspector-fields.test.ts` (8 cases).
**Blockers:** none. **Rollback:** self-contained revert.

## 6. Exact Wall command and grouped undo

**State:** partial
**Owner:** `packages/command-system/src/command-lifecycle.ts`,
`packages/editor-shell/src/wall-draw-tool.ts`, `apps/web/src/canvas/`
**Done:** `wall-command-contract.test.ts` asserts the contract's four invariants
against the lifecycle this app actually runs, joined to the real grouped undo
stack and the real plan-document reducer: a rejected commit leaves both the
walls and the history untouched; one completed command is exactly one undo unit
however many segments it placed; cancel from previewing reaches `cancelled`
without canonical state moving; a preview and a pending numeric entry are both
non-canonical; the same tool id results from every invocation route.

**Architectural finding:** the repository has **two command state machines** -
`@arq/workspace`'s `ToolState` (nine phases, what apps/web dispatches) and
`@arq/command-system`'s `createCommandLifecycle` (eight states, reachable only
through @arq/editor-shell and not used by the app). Both are unit-tested; only
one runs. The package forbids parallel command buses, so this needs an owner
decision on which survives. Recorded, not resolved.
**Remaining:** the second lifecycle; exact numeric entry validation end to end
(the phase exists, the rejection path is asserted, but no numeric parser is
wired to it in the app); the six invocation routes are asserted at the reducer,
not driven through the real UI.
**Evidence:** `wall-command-contract.test.ts` (6 cases); `benchmark:wall-hud`.
**Blockers:** the two-lifecycle question needs an owner. **Rollback:**
self-contained test file.

## 7. Semantic plan projection using the golden fixture

**State:** partial
**Owner:** `apps/web/src/PlanCanvas.tsx`, `packages/plan-renderer/`,
`packages/geometry-2d/`
**Done:** the fixture's rooms now render - `roomsOnLevel` existed and nothing
called it, so 37 walls drew and 18 rooms did not, while the demo room drew on
top of the real building; room areas corrected (`calculatedArea` is already
square metres) and now match the package's own render room for room (Dining 9.2,
Kitchen 16.3, Living 24.2, Guest bedroom 18.5, Open courtyard 10.5); walls draw
at their own type thickness through the same `wallOutline` the 3D surface
extrudes; the view frames the project on open via the fit command.
**Remaining:** no poché (walls are stroked outlines, not filled); no hosted
openings, door swings or window symbols - the `.arq` reader does not parse them
at all, so this is reader work and not wiring; no dimensions; no wall joins
(`mitre-join.ts`, `butt-join.ts`, `t-join.ts`, `cross-join.ts` all exist and are
unwired); room labels collide in narrow rooms.
**Evidence:** `benchmark:native-open`, `benchmark:model-canvas`; runtime capture
of the fixture at desktop.
**Blockers:** none. **Rollback:** self-contained reverts per feature.

## 8. Opening-aware 3D and section or cutaway

**State:** partial
**Owner:** `apps/web/src/ModelCanvas.tsx`, `packages/model-renderer/`,
`packages/geometry-3d/`
**Done:** walls extrude at their own type thickness and height; the surface
follows the appearance (clear colour, floor and edge colour read from tokens)
rather than a hard-coded white.
**Remaining:** no opening subtraction (blocked behind the same reader gap as row
7); no section plane, section box or cutaway controls; camera fit is flat rather
than the reference's cutaway view.
**Evidence:** `benchmark:model-canvas` - selection round-trips plan to 3D and
back through the real UI.
**Blockers:** openings depend on row 7's reader work. **Rollback:** revert the
palette read and the dimensions map.

## 9. Regular and compact iPad composition

**State:** partial
**Owner:** `packages/workspace/src/responsive.ts`,
`packages/design-system/src/workspace/`
**Done:** the viewport probe now measures the document element's client box and
observes it, so the band converges on the truth however the viewport settles -
it previously measured once at mount and a stale read left a phone rendering the
tablet composition permanently; touch type scale keyed on `pointer: coarse`.
**Remaining:** a 1366px iPad lands on the `desktop` band (see the table above) -
the threshold, not the composition, is what needs deciding; Pencil hover intent,
one-supplementary-panel-at-a-time and keyboard-avoidance unverified. The 1024px
compact band is correct today: drawers-only, no docked panels, fixture
edge-to-edge.
**Evidence:** `benchmark:workspace-layout` covers 1194x834 and 834x1194;
`benchmark:pencil-input` and `benchmark:hover-sequence` pass.
**Blockers:** none. **Rollback:** self-contained.

## 10. Phone review, selection and measurement

**State:** partial
**Owner:** `packages/design-system/src/workspace/phone-dock.tsx`,
`packages/workspace/src/sheet-state.ts`
**Done:** `phoneBottomOwner` gives the phone exactly one bottom interaction
owner - the dock and a raised sheet both rendered before, leaving the dock
focusable and hit-testable behind a peeking sheet; the status strip gained a
`minimal` variant for the 28px slot the registry has always sized, dropping
readouts that describe a pointer a phone does not have; the plan no longer opens
at 1% zoom (the surface lays out at 0x740 before its first real pass and the fit
clamped, then never ran again).
**Remaining:** no recent-projects surface (section 11 requires one alongside
project opening); measurement (endpoints, snapping, live value, cancellation,
completion) not implemented; markup, issues and revision review unverified.
Opening itself works and is evidenced.
**Evidence:** `phone-bottom-owner.test.ts` (5 cases); runtime capture at
430x932 with mobile emulation.
**Blockers:** none. **Rollback:** self-contained.

## 11. Project Home and project-open lifecycle

**State:** partial
**Owner:** `apps/web/src/file-handling/`, `apps/web/src/project/`,
`packages/arqfs/`, `apps/web/src/App.tsx`
**Done:** opening the golden fixture works end to end and shows canonical data.
**Remaining:** the 5,000-row synthetic tree is gone; the hard-coded demo room and
the two invented tree rows are not, and must not be what a reader sees first.
Project Home is not the entry surface; source verification, compatibility,
migration, working-copy creation and read-only fallback are not distinguished in
the interface.
**Evidence:** `benchmark:native-open`, `benchmark:e2e-arq-open`,
`benchmark:file-open`, three `arqfs` checks.
**Blockers:** none. **Rollback:** self-contained.

## 12. Recovery and portable publication

**State:** partial
**Owner:** `packages/arqfs/src/arqfs-publication.ts`,
`apps/web/src/project/deliver-published-copy.ts`,
`apps/web/src/project/describe-publication-outcome.ts`,
`packages/arqfs/src/arqfs-recovery-report.ts`,
`apps/web/src/canvas/plan-journal.ts`

**Audit finding that changed this row.** Portable publication was not missing.
`publishProjectFile` has been complete for some time: it exports sidecar-free
bytes, reopens them through a reader that shares no cache or transaction with
the writer, and returns bytes only after project identity, revision, per-entry
digests, SQLite integrity and the length-framed semantic hash all match. It
refuses on eleven named failures. `NativeProjectSession.publish` wraps it and is
tested. **Nothing in the application ever called it.** The same is true of
`buildArqfsRecoveryReport` and `resolveArqfsSafeModePlan`, which no code outside
their own tests calls at all - so the "no destructive default" property held
only because no recovery path ran.

**Done.** Publication is now reachable and truthfully reported.

- `Save a copy` is a real command-palette entry, disabled with its reason when
  no native project is open rather than hidden.
- `describe-publication-outcome.ts` is the single place a verdict becomes copy,
  exhaustive over `ArqfsPublicationRefusal` so a new refusal fails to compile
  rather than reaching a user as a generic failure. Every refusal carries the
  sentence saying the project on this device still holds every change - appended
  by the module, not per branch, and asserted over the whole union.
- Delivery is separated from verification: a download the browser refused is
  reported as a download failure, never as a corrupted copy.
- Atomicity at the hand-over seam: bytes are copied into a fresh buffer and
  handed over as one `Blob`, so a caller reusing a transferred buffer cannot
  change what the user receives, and no truncated file can arrive named as
  though it were whole.
- The outcome gets a non-dismissable dialog, not only a four-second toast: on a
  refusal the diagnostic and the reassurance are the whole message.

**Done, second slice: the open path now asks about the file's condition.**
`buildArqfsRecoveryReport` and `resolveArqfsSafeModePlan` had no caller outside
their own tests, so every open decided writability from the format version
alone. A working copy whose last local write never reached commit, or whose
SQLite integrity checks fail, opened fully editable - and the first save
committed on top of a revision the project never committed to, destroying at
that moment the only state a recovery could have been built from.

The Worker's `open` now builds the recovery report (one open, not two) and
carries the resulting plan on the same payload as the format verdict, so a
caller cannot act on one before the other arrives. The condition can only
remove write access, never grant it.

Deliberately narrowed: only `corrupt` and `interrupted-write` take write access
away, defined once in `conditionForcesReadOnly` and shared by the Worker that
enforces it and the copy the user reads, so the refusal and the explanation
cannot disagree. Applying the whole plan broke 18 existing Worker contracts and
was wrong to begin with - `missing-required-entries` describes a chosen file,
and a working copy this build just initialised has no required entries either,
so it would have opened every new project read-only. Those kinds stay with
`native-open-policy.ts`, which already decides them.

The user-facing result: an interrupted-write project opens read-only, says so,
and says the original is untouched and can be copied before anything changes.
A project that fails its own consistency checks is refused rather than opened.

**Remaining:** the recovery _comparison_ surface (source, last-known-good,
recoverable working copy side by side) does not exist - the app now refuses or
degrades correctly, but offers no choice between versions. Interruption paths
across a real publish are untested in a browser.

**Evidence:** 22 new tests in `apps/web/src/project/`.

- Publication copy and delivery: `partially-verified`. They cover the copy
  contract over the full refusal union, the file-name derivation and the
  delivery seam against a fake browser environment; they do not drive a real
  OPFS publish. `arqfs-publication.test.ts` covers the verification itself
  against a real SQLite driver.
- The open condition gate: `verified` for the paths a browser exercised.
  `run-native-open-capability-check.mjs` opens the golden fixture through the
  real interface in headless Chromium and passes with the gate in place, as do
  `run-e2e-arq-open-capability-check.mjs` (four open outcomes against real
  OPFS), `run-file-open-capability-check.mjs`,
  `run-arqfs-project-isolation-capability-check.mjs` and
  `run-arqfs-writer-lock-capability-check.mjs`. The interrupted-write and
  corrupt branches themselves are covered by unit tests only - no check seeds a
  half-written `.arq` in a browser yet.

`pnpm vitest run`: 3,566 tests, 331 files, uncached. Typecheck, lint and
`pnpm --filter @arq/web build` clean; language ladder refreshed, audit PASS.

**Regression this slice caught in itself:** taking a _value_ from the
`@arq/arqfs` barrel dragged the Node-only atomic swap into the browser bundle
and failed the build. Caught by `run-native-open-capability-check.mjs`, not by
tests or typecheck - the deep import is the fix, and the reason is recorded at
the import.

The row stays `partial`: no headless check drives `Save a copy`, and the
recovery comparison surface does not exist.

**Blockers:** none. **Rollback:** the command entry and its handler are additive;
removing the palette entry removes the surface without touching `@arq/arqfs`.

## 13. Sheets and vector PDF

**State:** not-started
**Owner:** `packages/pdf-export/`, `packages/plan-renderer/src/sheet-viewport.ts`
**Done:** nothing in this change set.
**Remaining:** semantic viewports, scale, crop, title blocks, page settings,
vector-first export, font and raster-fallback reporting, publication evidence.
**Evidence required:** sheet and PDF tests; no vector-fidelity claim until
tested.
**Blockers:** none identified, but this is the largest untouched row.
**Rollback:** n/a.

## 14. Dark appearance, accessibility, localisation and performance closure

**State:** partial
**Owner:** `packages/design-system/src/shell/shell-tokens.css`,
`packages/design-system/src/interaction-foundation/`
**Done:** dark appearance works end to end - the tokens flipped correctly before
but nothing applied a background or text colour at the root, so the page stayed
the browser default and dark left a full-height white rectangle where the
drawing is; both renderers now take ink, paper and accent from the appearance;
`color-scheme` declared; the dark focus ring went from a failing 2.83:1 to
8.7:1; every rendered token pair measured against WCAG 2.2 in both appearances;
the anti-inversion check is channel-space plus a chroma signature, because
reversing the surface ramp proves nothing and luminance is compressed near zero.
**Remaining:** no visual-regression baselines; VoiceOver, Voice Control, Switch
Control and browser zoom unverified; localisation and bidirectional layout not
started; no measured `backdrop-filter` frame cost, memory or large-project
performance.
**Evidence:** `dark-appearance.test.ts` (32 cases).
**Blockers:** none. **Rollback:** flip `APPEARANCE_POLICY['dark-appearance']`.

---

## Resume instructions

Re-verify the current immutable HEAD, then continue from the first row below
`verified`. Do not restart, reset or repeat completed work. The authorised
delivery stop remains pull request plus verified preview.

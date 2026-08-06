# ARQ Version 13 implementation ledger

A resumable task ledger for the Version 13 implementation, and nothing more. It
decides no lanes, gates or evidence sufficiency: ZEUS (`.zeus/FAST-KERNEL.md`)
routes the work and Engineering OS (`engineering/`) remains the merge authority.
Where this file and either of those disagree, they win.

**Branch:** `claude/arq-liquid-glass-12-5gstys` (continued, not restarted)
**Base:** `claude/arq-cad-platform-research-ba8rav` (this repository's default)
**Pull request:** ruddvz/Arq#303
**Delivery stop:** pull request plus verified preview. Not merge, not production.
**Version 12 ledger:** `ARQ_V12_IMPLEMENTATION_LEDGER.md`, still current for the
rows Version 13 renumbers.

## States

`not-started` · `partial` · `implemented` (built, focused tests pass) ·
`verified` (built, tested, **and observed running at the required viewports**) ·
`blocked`. Only `verified` is green.

## Package provenance

- ZIP SHA-256 `bfdf37357b9f94e1458cb4f8c5ddb65452db6d79b5c7aedf009a17f7357b6e85`,
  matching the value supplied with the package. 311 files extracted.
- `reference-app/data/ARQ_Courtyard_House_Golden_Fixture_v2.arq` is
  **byte-identical** to `fixtures/ARQ_Courtyard_House_Golden_Fixture_v2.arq`
  already in this repository (SHA-256 `0afd9a97…87bd6`). The canonical data is
  the same data; only the reading of it differs.
- The reference app was run from the package (`python3 -m http.server`) and
  captured directly at 1600x1000, 1366x1024, 1024x768 and 430x932. It renders
  the canonical model: "Courtyard House Reference · Revision 191", 34 named
  rooms with computed areas, and counts of 79 walls, 14 doors, 16 windows.

## Honest reading of what the package contains

Stated plainly because the package's own summary is optimistic in one place:

- **The reference app is real.** `app.js` 15.7 KB, `styles.css` 16 KB, and a
  51 KB canonical model extracted from the fixture. It renders poché walls,
  filled and labelled room polygons, door swings, window sills and dimension
  strings. It is a genuine executable target and was used as one.
- **The React adaptation files are sketches, not components.** Every file in
  `implementation/react/` is between 255 bytes and 2.1 KB
  (`CommandShelfV13.tsx` 843 bytes, `PlanRendererV13.tsx` 1.5 KB,
  `command-machine.ts` 855 bytes). They are useful as intent. They are not code
  that can be adapted in place of the repository's own owners, and adopting
  `command-machine.ts` would create the third command state machine in a
  repository that already has one too many.
- `integration/REPOSITORY_COMPONENT_MAP.csv` ships **empty**. Completed at
  `docs/v13/REPOSITORY_COMPONENT_MAP.csv` before any edit, as the start file
  requires.

## Slices

Numbering follows `integration/IMPLEMENTATION_SEQUENCE.md`.

### 1. Repository mapping and current-diff audit

**State:** implemented
**Evidence:** `docs/v13/REPOSITORY_COMPONENT_MAP.csv`, all 14 rows completed
against real paths and symbols. Version 12 diff, open PR, branch and HEAD
recorded above. **Rollback:** documentation only.

### 2. Token and icon adapter reconciliation

**State:** partial
**Done:** the repository's token system is the single one; `--arq-site-font`
binds to the existing `--arq-font-ui` rather than introducing a family.
**Remaining:** reconcile `contracts/design-tokens-v13.json` value by value; 24
of 54 tools still lack glyphs.
**Decision recorded:** Tabler is **not** adopted. The repository already has a
house-style icon adapter and eight hand-drawn group glyphs; adding a second
family would be the mixing the package itself forbids. **Rollback:** tokens are
additive.

### 3. Shell composition and stable viewport

**State:** partial (carried from V12 rows 4 and 9)
**Done:** floating composition on wide pointer-fine bands; viewport probe
measures the layout viewport and observes resize; camera is preserved across
panel open and close.
**Remaining:** 1366px iPad still resolves to the `desktop` band.

### 4. Selection and Inspector

**State:** partial (V12 row 5)
**Remaining:** contextual Inspector and a pin concept; 3D is not a selection
source.

### 5. Wall command and grouped undo

**State:** partial (V12 row 6)
**Done:** the command contract is asserted against the lifecycle the app runs,
joined to the real undo stack and real operation inversion.
**Remaining:** owner decision on the second command state machine.

### 6. Golden-fixture semantic plan

**State:** implemented
**Owner:** `packages/project-loading/src/native-project-model.ts`,
`packages/plan-renderer/src/plan-openings.ts`,
`packages/plan-renderer/src/canvas2d-paint.ts`, `apps/web/src/PlanCanvas.tsx`

**Done.** The golden fixture's ground floor now draws as a plan rather than as a
wireframe: 37 walls filled with poché, 18 tinted and labelled rooms, and the
level's doors and windows as real openings.

- The reader parses `openings`, `doors` and `windows` instead of counting them
  as unsupported. It refuses an opening with no host wall, one running past its
  wall's end, a swing that would sweep back through the wall, and two instances
  in one void - each checked where the question can actually be answered.
- `plan-openings.ts` projects an opening onto its host wall: reveal, jambs, door
  leaf, swing arc, window glazing. Its own projection rather than a reuse of the
  3D one, because a leaf and a swing exist only in plan and the sill and head
  heights the 3D module needs mean nothing here. The two share the canonical
  record, which is the right thing to share.
- An opening is a hole, not a lid. A wall with openings is drawn as the
  stretches that remain solid - the same decomposition `generateWallOpeningMeshes`
  performs in three dimensions - so a filled wall cannot print solid over its own
  doors in a vector sheet.
- Poché and room tint are a `fill` on the existing polygon primitive rather than
  a new primitive kind: a filled wall is the same shape in the same place, and
  every consumer that already hit-tests, selects, exports or measures a polygon
  keeps working unchanged. Both colours come from the appearance, so poché is a
  light solid on a dark page rather than a black shape on near-black.

**Remaining:** wall joins (four join modules exist unwired, so wall ends meet
rather than mitre), room-label collision at small scales, and the fixture's five
linear dimensions - still reported as unsupported, truthfully.

**Evidence:** 25 new tests across `plan-openings.test.ts` and
`canvas2d-paint.test.ts`; `golden-fixture-model.test.ts` reads the repository's
own `.arq` and asserts 79 walls, 30 openings, 14 doors, 16 windows, 34 rooms
from the file itself. `run-native-open-capability-check.mjs` opens the fixture
through the real interface in headless Chromium and now saves the plan surface
(`benchmarks/results/native-open-plan.png`) - it ended every run on the 3D tab
before, so the surface most of this work changes had no capture at all.

**Not `verified`:** the plan is captured at one viewport by that check, not at
all four required classes, and no visual-regression baseline compares it against
the Version 13 reference.
**Rollback:** the fill is optional and absent means outline-only; the openings
map is optional and an absent entry draws a wall solid, exactly as before.

### 7. Opening-aware 3D and section

**State:** implemented (openings), not-started (section and cutaway)
**Owner:** `apps/web/src/ModelCanvas.tsx`, `packages/geometry-3d/src/wall-opening-meshes.ts`

**Done.** The 3D view cuts its openings. `generateWallOpeningMeshes` decomposes
a wall into the panels that survive its openings - pier, sill, header - and had
never been called by anything but its own tests. A wall with openings now
extrudes as those panels, so a door is a hole through the model rather than a
rectangle drawn on its face.

Two things were passed to 3D for the first time in the same change: the
project's own wall dimensions, and its openings. 3D was extruding every wall at
a single borrowed default, so an opened project's wall types reached the plan
and not the model.

Selection survives the split. Every panel carries its wall's element id, so a
raycast landing on a pier between two windows selects the wall, and the
selection treatment is resolved once per wall and applied to all its panels -
otherwise a selected wall highlights between its openings and stays plain
beside them.

**Also removed here:** the 3D starting-room outline, the other half of the demo
content taken out of the plan. A loop drawn at real world coordinates by the
real renderer reads as the model whatever it is captioned.

**Regression caught and repaired in the same run:** removing that outline left
an empty scene with no bounding sphere, so `fitBoundingSphere` threw "radius
must be a positive finite number" during render and the 3D canvas never mounted.
`run-model-canvas-capability-check.mjs` caught it; unit tests and typecheck did
not. `contentSphere` now returns a starting extent for an empty scene, which is
exactly the guard the plan surface needed on the same removal.

**Remaining:** section and cutaway. `packages/geometry-3d/src/section-box.ts`
exists and is unwired.

**Evidence:** `run-model-canvas-capability-check.mjs` and
`run-native-open-capability-check.mjs` both green; the saved capture shows the
fixture's openings cut through the walls, including on the selected wall.
**Rollback:** the openings map is optional; an absent entry extrudes the wall
solid exactly as before.

### 8. Regular and compact iPad

**State:** partial (V12 row 9)
**Measured, not asserted:** `run-responsive-capture.mjs` records the band the
product itself resolves at each viewport. A 1366x1024 iPad resolves to
`desktop`, not to a tablet band, because `resolveWorkspacePlatform` only treats
a coarse pointer as a tablet below 1280px. It gets touch sizing from the
`pointer: coarse` rules and the desktop composition. That is a threshold
decision for the owner, not a defect this change should silently move.

| Viewport | Band resolved | Canvas | Fixture opens | Overflow |
| --- | --- | --- | --- | --- |
| 1600x1000 | `desktop` | 1380x776 | yes | none |
| 1366x1024 | `desktop` | 1180x847 | yes | none |
| 1024x768 | `tablet-landscape` | 1008x572 | yes | none |
| 430x932 | `phone` | 414x740 | yes | none |

### 9. Phone review, selection and measure

**State:** partial (V12 row 10)

### 10. Project Home and open lifecycle

**State:** partial (V12 row 11)
**Done this session:** demo content removed - no hard-coded rectangle, no
invented tree rows. **Remaining:** Project Home as an entry surface; recent
projects.

### 11. Recovery and portable publication

**State:** partial (V12 row 12)
**Done this session:** publication reachable and truthfully worded; the open
path now asks the recovery report what condition a file is in before deciding it
is editable. **Remaining:** recovery comparison surface.

### 12. Sheets and vector PDF

**State:** not-started (V12 row 13)
**Note:** `packages/pdf-export` and `sheet-viewport.ts` exist and are unwired -
the same built-and-never-wired pattern that has accounted for most of this
work's findings.

### 13. Dark and accessibility fallbacks

**State:** partial (V12 rows 3 and 14)
**Done:** ADR-0031 and ADR-0032; material layer with four fallbacks; designed
dark appearance with measured contrast.

### 14. Performance, hostile input, visual regression and preview verification

**State:** partial for capture, blocked for preview

**Done:** `scripts/run-responsive-capture.mjs` captures the running product at
all four required viewport classes with the golden fixture opened through the
real dialog. Each capture is a real browser laid out at that size with the
pointer type that band really has - a tablet and a phone report a coarse
pointer, and capturing them with a mouse would resolve a band no such device
resolves, which is the scaled-desktop failure in a subtler form. Nothing is
scaled, reused between sizes, or shown in a device frame.

Each viewport also asserts in-page the three things Version 13 rejects: no
"demo fixture" string, no "Fixture wall" string, no horizontal overflow. All
four pass, and all four open the fixture.

`data-workspace-platform` was added to the workspace root so the band is
observable rather than parsed out of a class name or - worse - assumed from the
viewport that was asked for, which is exactly how a desktop composition gets
recorded as phone evidence.

**Harness defect caught and repaired in this run:** the first version waited for
"revision 191", which only the desktop project panel renders, and reported "the
fixture did not open" on iPad-compact and phone while the same run recorded the
project name on screen. A harness assumption about one band's chrome, nearly
published as a product failure on another - the same shape as the earlier
"Open" label mistake.

**Visible in the phone capture and still open:** room labels collide at small
scales. Recorded under slice 6's remaining work.

**Blocked, unchanged and external:** no CI run exists for this PR, and no
preview exists for `apps/web`.
**Blockers:** both external and unchanged from Version 12.
1. **GitHub Actions has produced no run** for this PR across every push.
2. **No preview exists for `apps/web`.** Vercel builds `arq-website` only, so
   the delivery stop's verified preview has nothing to verify for the code being
   changed.

## Standing blockers

Neither clears by implementing more; both are owner actions. Recorded here so no
slice is marked `verified` on their account, and so the absence is never
presented as a pass.

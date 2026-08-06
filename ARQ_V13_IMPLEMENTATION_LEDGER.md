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
**Done:** all 54 tools have a glyph, from one pinned family. `--arq-font-ui` is
bound to Plus Jakarta Sans - the family `apps/marketing` already self-hosts - so
the editor and the site that sells it are set in the same type, and no typeface
was added. JetBrains Mono carries the readouts that are measurements.

**Decision reversed, and why.** An earlier pass declined Tabler and kept the
repository's hand-drawn set. That was wrong, and looking at the glyphs at 16px
is what showed it: the set was uneven in weight, optical size and idiom, and
nine of them were a bare 14x14 rect - one identical, meaningless square standing
in for nine different tools, which had passed every test because a placeholder
is a real component rendering real SVG.

Tabler 3.45.0 is now pinned, single family, and it is Version 13's own reviewed
candidate. It was checked against Lucide rather than assumed: Tabler draws
stairs, a wall, a door, a fence, an angle, a cube and a perspective frustum, and
Lucide draws none of them - so with Lucide half the list would have fallen back
to hand-drawing, which is the problem being fixed. Coverage of the domain is
what decides an icon set for a BIM product.

The names stay ARQ's, so the family can be re-pinned in one file without
touching a call site. Two mappings remain compromises, recorded at the adapter:
Tabler has no roof and no slab.

**Remaining:** reconcile `contracts/design-tokens-v13.json` value by value.
**Rollback:** the adapter is one file; the font is a token plus two `@font-face`
rules.

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

**Room labels no longer collide.** `roomLabelText` had built a two-line label
since it was written and nothing used it - the app assembled its own single line,
twice as wide as it needed to be, and `fillText` renders a newline as a space
anyway, so even a two-line label would have come out as one. Both are fixed, and
a label is now drawn only when it fits inside its own room at the scale being
drawn. On a phone the fixture's galleries are a few millimetres wide and their
labels were wider than the rooms; three overlapped into a smear that also hid
the walls. The room is still drawn, still selectable and still names itself in
the Inspector, so nothing is lost but a claim that could not be read.

**Remaining:** wall joins, and the fixture's five linear dimensions - still
reported as unsupported, truthfully.

#### Wall joins: audited, deliberately not started

`mitre-join.ts`, `butt-join.ts`, `t-join.ts` and `cross-join.ts` all exist with
their own tests and no production caller. Wiring them is not the mechanical
substitution it looks like, and the analysis is recorded here so the next
session starts from it rather than re-deriving it.

`faceLineCorners` returns `[leftStart, leftEnd, rightEnd, rightStart]`. Mitring
wall A's **end** against B means replacing indices 1 and 2 with
`mitreJoinCorners(...).left` and `.right`; mitring its **start** means replacing
indices 0 and 3. That part is straightforward.

Three things make it not straightforward, and each is a way to produce an
inverted or exploded corner on the golden fixture's non-orthogonal walls:

1. **Orientation.** `mitreJoinCorners` intersects A's left face line with B's
   left face line, and "left" is defined by each wall's own direction. Only the
   `A.end === B.start` case has both lefts on the same side. `A.end === B.end`
   and `A.start === B.start` need one wall reversed first, and the resulting
   corners then have to be mapped back to the unreversed wall's left and right -
   getting that backwards swaps the two corners and turns the wall inside out at
   that end.
2. **Arity.** A corner shared by three or more walls is a T or a cross, not a
   mitre, and `t-join.ts` and `cross-join.ts` exist precisely because the mitre
   answer is wrong there. The join kind has to be chosen from how many walls
   meet at the point, not assumed.
3. **Near-parallel walls.** `lineIntersection` returns null for parallel faces,
   but two walls meeting at a very shallow angle intersect a long way from the
   corner - a mitre spike that is geometrically correct and visually a defect.
   A spike limit is needed, and the fixture has shallow-angle walls.

The model also carries `joinStart` and `joinEnd` intents per wall (`auto`, and
whatever else the schema allows), which the parser already reads and nothing
consults. The join kind should come from those plus the arity, not from geometry
alone.

Not attempted in this session rather than attempted badly: a wrong join is
poché drawn in the wrong place, which is the most load-bearing thing on a plan
and the least likely to be noticed in a diff.

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

**State:** implemented (single-sheet plan export), not-started (sheet set,
title blocks, page settings)
**Owner:** `apps/web/src/sheets/sheet-export.ts`,
`packages/pdf-export/src/pdf-sheet-export.ts`,
`packages/plan-renderer/src/sheet-viewport.ts`

**Done.** `Export sheet as PDF` produces a real vector sheet from the drawing on
screen. Every piece already existed and none was reachable: `buildPlanViewport`
projects a plan scene into paper space, `exportSheetToPdf` writes PDF vector
operators, `applySheetExportMetadata` stamps the document. This slice is the
orchestration between them, plus the place the export's limits are written down.

- The scene comes from the canvas rather than being rebuilt, so the sheet
  carries exactly what is on screen. Two projections would eventually disagree,
  and the sheet is the one nobody can check against the screen once printed.
- Scale is honoured, not fitted to page. A drawing issued at 1:100 must measure
  1:100 under a rule, so a model too large for the paper overflows rather than
  being quietly shrunk - silently rescaling turns a sheet into a lie about its
  own dimensions.
- The model is centred on the paper, so a project authored a kilometre from the
  origin does not export a blank page.
- Delivery reuses the publication hand-over seam with a different media type
  rather than adding a second download path.

**Truthfully reported, not implied.** The exporter is a documented prototype:
Helvetica rather than the Arq typeface, one flat line weight, no title block.
Those four limits travel with the file and are shown when it downloads, because
a PDF that quietly substitutes a font and flattens line weights looks finished
and is discovered otherwise at the printer.

**Evidence:** 7 focused tests. Driven end to end in headless Chromium against
the golden fixture: the command produced `A101 Level 1 Plan.pdf`, 9,775 bytes,
`%PDF-` header, **2,200 vector path operators and no image XObject, DCTDecode or
JPXDecode** - so the vector claim is measured, not asserted. Document metadata
verified present (`/Title`, `/Subject`) as UTF-16 in a compressed object stream.

**Remaining:** sheet sets, title blocks, north point, scale bar, page settings,
crop, and per-element line weights on the sheet.
**Rollback:** the command entry and handler are additive; the shared delivery
seam keeps its previous default media type.

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

**Found by the phone capture and since fixed:** room labels collided at small
scales. Recorded under slice 6.

**Blocked, unchanged and external:** no CI run exists for this PR, and no
preview exists for `apps/web`.
**Blockers:** both external and unchanged from Version 12.
1. **GitHub Actions has produced no run** for this PR across every push.
2. **No preview exists for `apps/web`.** Vercel builds `arq-website` only, so
   the delivery stop's verified preview has nothing to verify for the code being
   changed.

## Linear dimensions: audited, not started

The last entry in the unsupported-content list, and the mockups' "14 000"
string. Audited rather than started, for the same reason as wall joins: the
resolution step is real geometry and rushing it produces a drawing that states a
measurement confidently and wrongly.

Everything below the reader already exists and has no caller: `LinearDimension`,
`DimensionReference`, `measuredLinearDimensionLength`,
`linearDimensionIsDetached` and the text formatter.

What the fixture actually holds: five dimensions, each referencing two walls by
`{ kind: 'wall-reference-line', wallId }`, with an offset, a precision and a
suffix. Four are plan dimensions between parallel wall pairs (overall x and y,
courtyard x and y); the fifth, `dim-storey`, is vertical and has no plan
projection at all.

Three things decide whether this is right:

1. **Resolution.** `measuredLinearDimensionLength` takes two *points*, and a
   `wall-reference-line` is a *line*. Picking arbitrary points on two parallel
   walls measures a diagonal, not the separation - `dim-overall-x` would read
   something other than 12,000 while looking entirely plausible. The honest
   resolution is the perpendicular distance between the two reference lines,
   which is exact for parallel walls and ill-defined otherwise. A dimension
   between non-parallel walls should be reported as one this build cannot draw
   rather than measured anyway.
2. **`fixtureExpectedValueMm` must not be displayed.** Each record carries it,
   and it is a fixture assertion - what the value *should* be - not the value.
   Rendering it would put fixture metadata on a drawing as a measurement, which
   is precisely the class of thing this work has been removing. It is useful as
   a test oracle and nothing else.
3. **The vertical one.** `dim-storey` cannot appear on a plan. It belongs in the
   unsupported list with a reason, not dropped silently.

Until those land, the reader continues to report `linearDimensions` as content
it does not draw, which is true.

## Mockup reconciliation

The mockup package (`ARQ_MOCKUPS_V12_V13_ONLY`) was read in full - 24 images.
The consistent editorial set is the **Version 12 individual screens** plus the
Version 13 desktop-core board: light appearance, the real product, the real
Courtyard House fixture at revision 191. The Version 13 iPad board is a
different product entirely ("Nebula Research Initiative", a document app) and
the Version 13 phone and workflow boards are dark marketing renders of other
projects. Those were not implemented against.

Taken from the reference and shipped: the Inspector following selection, the
mode rail as a 56px dock, the drawing on a sheet, room tints by category, the
project bar as glyphs, the status strip as a pill, and the view's own title.

**One conflict was refused, and this is the record of it.** The reference
composition merges save state and sync state into a single "Local current" chip
with a green dot. `top-bar.tsx` carries the opposite as an invariant - "save and
sync must be separate concepts, two independent indicators, never merged, even
when both collapse together" - and this build depends on it being true: sync is
`not-configured` because no sync backend exists, while save is real and
journalled to IndexedDB. A single green chip reading "Local current" tells a
user their work is somewhere other than this device. It is not. The mockup is
right about the visual weight and wrong about the merge, so the two indicators
stay two.

**One is an owner decision, not a design one.** The reference status strip
carries two fields; ours carries nine. The pill shape is in, but which of the
nine earn permanent space at the bottom of the screen is a product call - and
two of them, the working-copy statement and the sync state, exist specifically
so the product never implies a save it has not made.

## Standing blockers

Neither clears by implementing more; both are owner actions. Recorded here so no
slice is marked `verified` on their account, and so the absence is never
presented as a pass.

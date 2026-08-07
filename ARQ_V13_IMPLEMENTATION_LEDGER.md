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

Per-claim evidence in the tables below uses the Zeus vocabulary rather than these
slice states: `verified` · `partially-verified` · `inferred` · `assumed` ·
`blocked` · `not-inspected` · `failed`. No other word is used, so a row can never
be graded on a scale invented for it.

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

| Viewport  | Band resolved      | Canvas   | Fixture opens | Overflow |
| --------- | ------------------ | -------- | ------------- | -------- |
| 1600x1000 | `desktop`          | 1461x819 | yes           | none     |
| 1366x1024 | `desktop`          | 1253x876 | yes           | none     |
| 1024x768  | `tablet-landscape` | 1024x577 | yes           | none     |
| 430x932   | `phone`            | 430x767  | yes           | none     |

Every canvas above is wider than it was a session ago, and none of it came from
a layout change. The browser's default `body { margin: 8px }` had never been
reset, so the shell was inset 8px on every side of every band: sixteen pixels of
every viewport's width, and - because the shell asks for a full viewport of
height starting 8px down the page - its last 8px always below the fold. On the
wide bands that overhang landed in padding and cost nothing visible. At 1024px
the status strip wraps to two lines, and the second line, which carried sync
state, was cut off by the bottom of the window.

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

1. **Resolution.** `measuredLinearDimensionLength` takes two _points_, and a
   `wall-reference-line` is a _line_. Picking arbitrary points on two parallel
   walls measures a diagonal, not the separation - `dim-overall-x` would read
   something other than 12,000 while looking entirely plausible. The honest
   resolution is the perpendicular distance between the two reference lines,
   which is exact for parallel walls and ill-defined otherwise. A dimension
   between non-parallel walls should be reported as one this build cannot draw
   rather than measured anyway.
2. **`fixtureExpectedValueMm` must not be displayed.** Each record carries it,
   and it is a fixture assertion - what the value _should_ be - not the value.
   Rendering it would put fixture metadata on a drawing as a measurement, which
   is precisely the class of thing this work has been removing. It is useful as
   a test oracle and nothing else.
3. **The vertical one.** `dim-storey` cannot appear on a plan. It belongs in the
   unsupported list with a reason, not dropped silently.

Until those land, the reader continues to report `linearDimensions` as content
it does not draw, which is true.

## Mockup reconciliation

The mockup package (`ARQ_MOCKUPS_V12_V13_ONLY`) contains 24 images. The
reference set is the **Version 12 individual screens**: light appearance, the
"a" mark, the real Courtyard House fixture at revision 191, phthalo green as the
accent. The Version 13 boards are a different visual direction with a different
project name ("Evergreen Residence", blue accent, photoreal 3D), the Version 13
iPad board is a different product entirely, and the Version 13 phone and
workflow boards are dark marketing renders. None of those were implemented
against.

**An earlier version of this section overstated what had been taken from the
reference, and it was corrected only after the owner asked directly whether the
two had actually been compared. They had not.** What had happened was
self-critique against the captures - which found twelve real defects and fixed
them - and no side-by-side reading against the mockups at all. The list below is
the result of finally doing that, and the divergences are recorded because the
first version of this paragraph is what a claim looks like when it is inferred
rather than checked.

### Matched, after the comparison

| Reference                                                                   | State   |
| --------------------------------------------------------------------------- | ------- |
| `Plan │ 3D │ Sheets` capsule, centred in the project bar                    | shipped |
| One 56px dock down the drawing's edge, active in the accent                 | shipped |
| Panel tabs `Views │ Model │ Sheets`, search field, accent-tinted active row | shipped |
| Counts read "37 walls"                                                      | shipped |
| The view's title on the sheet's top-left corner, straddling the edge        | shipped |
| A control cluster on the sheet's top-right                                  | shipped |
| Status strip: two groups at the two ends, sentence case, not monospace      | shipped |
| The open courtyard hatched                                                  | shipped |
| The drawing on a sheet, room tints by category, poché                       | shipped |

### Diverged, deliberately

- **The "Local current" chip.** The reference merges save state and sync state
  into one green chip. `top-bar.tsx` carries the opposite as an invariant, and
  this build depends on it: sync is `not-configured` because no sync backend
  exists, while save is real and journalled to IndexedDB. One green chip reading
  "Local current" tells a user their work is somewhere other than this device.
  It is not. The owner confirmed the refusal.
- **"hidden line" in the view's title.** The reference chip reads
  `Plan · hidden line · 1:100`. No view-style concept exists anywhere in this
  repository, and printing a fixed "hidden line" would assert a rendering mode
  the product neither chooses nor offers.
- **The declared scale.** The fixture's `views.json` says `1:100` and the
  reference prints it. The chip prints the _measured_ scale, because at fit zoom
  the drawing is not at 1:100 and must not say it is. Opening a plan at its
  declared scale is a real follow-up; it is a behaviour change, not a label one.
- **`m2` rather than `m²`.** The reference writes `m2`. That is a mockup
  limitation, not a target.
- **Labelling every small room.** The reference labels Powder room, Linen and
  Guest ensuite - and in it, "Linen 2.3 m2" and "Guest ensuite 3.4 m2" visibly
  overlap the wall between them. That is the defect the room-label work removed.
  This names fewer rooms and none of them wrongly.
- **"Ground floor cutaway"** in the reference's Views group. The string appears
  nowhere in the fixture. The real non-plan views are `Courtyard axonometric`
  and `Section A`, and those are what render.
- **Project overview's entrance.** The reference has none, and dropping the
  surface was not acceptable. The logo is a button now - the one affordance here
  not taken from the reference, chosen by the owner from four options.

### Not started, and why

- **The stair `UP` arrow.** The fixture's model carries no stairs, so there is
  nothing to derive one from. Inventing it would be demo content of exactly the
  kind this work has been removing.
- **The `14 000` dimension line.** The linear-dimensions slice, audited and
  recorded below as not started, with three unresolved questions of its own.

## Correction pass: what the captures showed and what was done about it

Everything below was found by looking at the four captures rather than at the
code, verified against the running product, and fixed in the same pass. Each is
`verified` as a rendering claim - the capture harness re-ran and the result was
re-read - and none of it changes the standing blockers, which are unchanged.

| Defect                                                     | Where it showed | Evidence state     |
| ---------------------------------------------------------- | --------------- | ------------------ |
| Room labels drawn through walls and door swings            | phone, desktop  | verified           |
| Five rooms losing their names to fix three                 | phone           | verified           |
| Page inset 8px on every side, sync state clipped           | all four        | verified           |
| Status strip stating a cursor a touch device has not got   | 1024, phone     | verified           |
| Tool chip taking a third strip above the phone dock        | phone           | verified           |
| An empty 38px context bar across the bottom of the drawing | desktop         | verified           |
| The view identity pill printed over a room                 | 1024            | partially-verified |
| The 3D ground plane swamping the building it stands under  | 3D view         | verified           |
| The Project overview rendering behind the project browser  | overview        | verified           |
| `view.kind` printed as copy: "3D 3d", "Level 1 Plan plan"  | overview        | verified           |
| Two panel disclosures, one shouting in caps                | desktop         | verified           |
| The panel's one command drawn without an edge              | desktop         | verified           |

One row above has been downgraded from `verified` to `partially-verified`, and
the correction belongs here rather than only in the section that found it. "The
view identity pill printed over a room" was marked `verified` on the strength of
having moved the pill to the sheet's corner and then looking at the captures.
Measuring them later showed it still covered the drawing by seven pixels at
1024x768. The fix was real; the evidence state was not. Reading a capture is not
measuring one, and `verified` was claimed on the weaker of the two. It is
measured under "The page did not fit on the page" below, and green there.

Three of these were the same mistake in different places: a surface that knew
its own geometry and not what was about to be drawn on top of it. The room label
measured its room and not the wall crossing it; the plan fit measured the canvas
and not the pill floating over it; the overview filled the viewport and not the
part of it a panel was not covering. Each is now told, by the thing that owns
the number, how much space is really there.

Two were values that had been widened past what they meant. `RecentViewSummary`
declared `kind: string`, so a registry token could be - and was - printed as
product copy. The status strip accepted `currentLevelName` and `pixelsPerUnit`
and rendered neither, so the app computed a level name for nothing. Narrowing
the first and deleting the second are the same fix.

### What this pass did not fix

- The sheet reads as a page in light appearance and only faintly in dark, where
  `--arq-ui-paper` (#171a1d) sits seven levels off `--arq-ui-canvas` (#101315).
  The page is still legible because the grid stops at its edge. Changing either
  token is an appearance decision with a wider blast radius than the defect.
- The status strip on a touch band still says "Tool: Select" in the position the
  reference gives to nothing at all. Which fields earn permanent space remains
  the owner decision recorded below.
- A plan wider than the canvas still runs behind the floating panel. That is
  deliberate for a drawing - it can be panned - and was only ever a defect for a
  document, which is what was fixed.
- Wall joins and linear dimensions remain audited and not started, for the
  reasons written above. Nothing in this pass changed that analysis.

## Optical Glass 2.0

Four stages, from the package uploaded with the question of why the shell was not
following the platform's squircle and glass language. What follows separates what
was verified from what was inferred, because the stage that mattered most is the
one that was nearly recorded as verified while being false.

| Slice                                                  | Evidence state     | How                                                                        |
| ------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------- |
| Quality policy resolving in order of authority         | verified           | 10 unit tests, and the resolved value read off the DOM in a browser        |
| Lens map: quantisation, LRU, ref counting, URL release | verified           | 13 unit tests                                                              |
| Refraction lens rendering on the view capsule          | verified           | filter, map URL and transform read from a live page                        |
| Downgrade to material and to opaque                    | verified           | `run-optical-glass-capability-check.mjs`, four browser configurations      |
| The material rendering in dark appearance              | verified           | same check; the dark tokens are a separate block and were never run        |
| `prefers-reduced-transparency` fallback                | partially-verified | stylesheet inspection only; Playwright cannot emulate the setting          |
| Squircle corners via `corner-shape`, pills included    | verified           | computed `corner-shape` read per control; the assertion fails when removed |
| That the squircle _reads_ as the platform's shape      | not-inspected      | the property is applied; whether the silhouette is right is a judgement    |
| How the material reads to a person                     | not-inspected      | no human has looked at it; captures are not judgement                      |
| Cost of the effect on a real GPU                       | not-inspected      | no frame timing was taken                                                  |

### The stage that passed while being false

The capability check passed on its first run. It should not have, and the reason
is worth keeping: it only asserted what happens when the effect turns **off**.
Nothing asserted that it was ever on.

It was not. Four surfaces carried `.arq-material--optical` and not one rendered
it. `.arq-workspace__bar > *` stripped the top bar's fill and border, leaving a
blur with no tint over it - a surface you can read the model straight through,
which is the outcome ADR-0031's unsupported-browser fallback exists to prevent,
reached from the supported path. The status bar and the dock were overridden to
an opaque paper fill with the `backdrop-filter` still running underneath: full
cost, no visible effect. The view capsule, nested inside the top bar's material,
had its fill and blur stripped by the never-nested rule while keeping the optical
variant's inset rim and 34px drop shadow - a bevel around an empty box.

Two failures made this invisible. The check tested the computed background
against a pattern written for the `rgb(r g b / a)` form, and Chromium serialises
`rgba(r, g, b, a)`, so it matched nothing in either direction and every row
reported `translucent: false`. And no assertion covered the default state at all.
A check that only watches a feature turn off cannot notice it was never on.

Both are fixed: the alpha is parsed rather than matched, and the default state is
asserted as strictly as the fallbacks - a surface that is bare, or opaque with a
blur behind it, now fails. One rule resolves the cascade: `material.css` decides
a material surface's fill, border and shadow, and nothing outside it may take
that decision back.

`--arq-optical-fill-solid` was 98% opaque. It is what every reduced-transparency,
increased-contrast and no-backdrop-filter path renders - readers who asked for no
transparency - so it is now fully opaque.

## The page did not fit on the page

Found by measuring the captures rather than reading them. The sheet is painted
six per cent outside the drawing's bounds and the fit fitted the drawing, so the
page ran off the top and bottom of the canvas at every viewport: the surface was
visible to the left and right of it and never above or below.

It broke the view title too. The title is placed from the sheet's top-left
corner, half its height above the edge. With that edge above the canvas, the
clamp that keeps chrome on screen fired at every band and pinned the title to the
canvas edge - seven pixels over the drawing's top wall at 1024x768. That is the
room-label defect from the correction pass above, on a different piece of chrome,
and it was introduced by the same pass that removed the fit's title reserve on
the reasoning that "the page's own margin holds it". The margin was real; the
page it belonged to was off-screen.

`run-sheet-chrome-capability-check.mjs` reads the rendered canvas pixels, because
the sheet has no element a DOM assertion could find. Evidence in both directions:
against the previous renderer it fails at all three bands; against this one the
page is inset 27-36px and the title clears the ink by 19-23px. `verified`.

The drawing renders slightly smaller as a result - the measured scale moves from
1:66 to 1:74 at desktop. That is the cost of showing the whole page, and the
readout is measured rather than declared, so it states it.

## The blocker that was not a blocker

"GitHub Actions has produced no run for this pull request" was recorded here
twice as an owner action, with the pattern said to point at repository run
approval or billing. It pointed at neither. The pull request had been
un-mergeable against its base, and a `pull_request` workflow runs against
`refs/pull/303/merge` - a ref GitHub cannot create while the merge conflicts.
No approval was withheld and no billing was exhausted; the branch had simply
drifted and nobody had merged the base into it.

Resolving five conflicts produced thirteen check runs where there had been one.
Two conclusions worth keeping:

- An absent signal is not evidence about why it is absent. The right reading was
  "no runs, cause not established"; what was written was a cause, inferred from
  a pattern, and filed under actions someone else had to take.
- Nothing had run against this branch for its whole life, so six checks had gone
  stale against a UI this work reshaped and one product guarantee had been
  removed - the panel line saying nothing is written back to the reader's own
  `.arq` file. All six are fixed and the guarantee is restored; the point is
  that local green said nothing about any of it.

Two checks fail for reasons that are genuinely not mine, and both fail correctly
rather than passing on absent evidence:

- `verify-routes` cannot read the marketing preview. Deployment Protection is on
  for that origin and no `VERCEL_AUTOMATION_BYPASS_SECRET` repository secret
  exists, so every path returns the sign-in page. The script refuses to report
  on routing it could not observe, which is the right behaviour. Owner action:
  Vercel project settings, Protection Bypass for Automation, stored as that
  secret.
- `benchmark:arq-core-worker` needs `rust/arq-core/pkg`, which this environment
  has not built. It is not in the CI job that runs the browser checks.

## Standing blockers

Recorded here so no slice is marked `verified` on their account, and so the
absence is never presented as a pass.

## Optical Glass 2.0 handoff report

The package's `10_REPOSITORY_IMPLEMENTATION_PROMPT.md` asks for Completed,
Verified, Inferred, Assumed, Blocked and Failed reported separately. They are.

**Base** `ca363be` (`claude/arq-cad-platform-research-ba8rav`).
**Head** `c8469ac` (`claude/arq-liquid-glass-12-5gstys`).

### Completed

Systems extended, not created. `material.css` gained a second set of values for
the existing `.arq-material` layer under ADR-0031; no second material system, no
new token file, no new appearance store. Fourteen files:

`appearance/optical-quality.ts` and its test - the quality policy.
`appearance/lens-map.ts`, `use-lens-map.ts`, `refraction-lens.tsx` and their
tests - the displacement map, its cache, and the filter that uses it.
`appearance/material.css` - the optical variant and its four fallbacks.
`appearance/index.ts`, `appearance-policy.ts` and the two policy tests.
`workspace/view-kind-switcher.tsx` - the capsule the lens decorates.
`workspace/workspace-shell.css` - the cascade fixes, and the squircle rule.
`scripts/run-optical-glass-capability-check.mjs` - the browser check.

### Verified

- The quality policy resolves in order of authority. 10 unit tests, and the
  resolved value read off the DOM in a real page.
- The map layer quantises, deduplicates in-flight requests, ref-counts, evicts
  oldest-first, never evicts a held map, and revokes what it drops. 13 tests.
- The lens renders: filter, map URL and slot transform read from a live page.
- The downgrade ladder holds in light, dark, forced colours and increased
  contrast: 0.72 alpha with blur by default, 1.0 with no blur in both
  fallbacks. `benchmark:optical-glass`, now run in CI.
- `corner-shape: squircle` is applied to the pills and buttons, asserted on the
  computed value. Proved to bite: replacing it with `round` fails the check at
  every configuration.
- Nothing the plan renderer draws changed. The renderer packages are untouched
  by this work, and the plan, Inspector and status output are unchanged.

### Inferred

- That the material reads as one surface rather than several at bands not
  captured. Four viewports were read; the other four pass the layout check but
  were not looked at for material quality.

### Assumed

- That Chromium's `corner-shape` implementation matches the platform's
  superellipse closely enough for the G2 intent. The property is applied and
  measured; its exact silhouette against Apple's is not something this
  repository can check.

### Blocked

- `prefers-reduced-transparency` has no Playwright emulation, so that row is
  stylesheet inspection rather than a rendered result. Stated in the check's own
  report as weaker evidence.

### Failed

- Nothing outstanding. Two failures during the work, both fixed and both
  recorded above: the lens aborted its own generation every render, and the
  capability check passed while the material was being overridden out from under
  every surface carrying it.

### Browser and device matrix

Chromium 141 only, headless, at 1600x1000, 1366x1024, 1024x768 and 430x932.
No other engine, no real device, no touch hardware. The optical check runs at
1600x1000 in four configurations.

### Performance and memory

The map cache is bounded and ref-counted, and object URLs are revoked on
eviction and teardown - asserted by unit test, which is a claim about the code
rather than about a device. **No frame timing and no memory profile was taken on
any hardware.** `not-inspected`, deliberately: the package asks for performance
evidence and this work has none to offer beyond the cost argument that the blur
is 16px rather than 28px and bounded by `contain: paint`.

### Feature control and rollback drill

`resolveOpticalQuality` is the single control. Returning `off` from it removes
the effect everywhere - proved by the forced-colours and increased-contrast rows,
which reach exactly that state through real settings and leave every surface
opaque with its controls intact. Removing `.arq-material--optical` from a surface
returns it to the regular material with no other change; removing the class from
`view-kind-switcher.tsx` was done during this work and is the rollback path for
the capsule specifically.

### Conflicts and unrelated changes

The cascade fixes in `workspace-shell.css` are not cosmetic and are not optional:
without them the optical variant does not render at all. They change how three
shell surfaces look, which is a wider blast radius than "add a variant" implies,
and is called out here rather than buried in the diff.

Unrelated to optical glass but in the same branch and the same push: the sheet
fit, the status-bar de-duplication, the base merge and the six stale checks. Each
has its own commit.

### Next concrete action

Owner: add `VERCEL_AUTOMATION_BYPASS_SECRET` so `verify-routes` can gather
evidence, and decide whether a preview for `apps/web` is in scope. Neither is
implementable here, and the delivery stop asks for a verified preview.

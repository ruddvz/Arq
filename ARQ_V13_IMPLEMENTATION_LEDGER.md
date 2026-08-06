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

**State:** partial (V12 row 7) - **the active slice**
**Done:** rooms, wall footprints from `wallOutline`, wall dimensions and live
palette all read from canonical data.
**Remaining:** hosted openings. The repository's reader currently *counts*
`openings`, `doors` and `windows` as unsupported content and says so truthfully
("Openings are recorded but not drawn in plan or 3D yet"). The fixture holds 30
openings, 14 doors and 16 windows with a clean canonical shape - host wall,
offset from wall start, width, sill height, height, side, hand, swing angle.
Also remaining: poché fill, wall joins (four join modules exist unwired), room
label collision.

### 7. Opening-aware 3D and section

**State:** not-started (V12 row 8 partial)
**Blocked on slice 6:** 3D openings need the same parsed canonical openings.

### 8. Regular and compact iPad

**State:** partial (V12 row 9)

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

**State:** blocked
**Blockers:** both external and unchanged from Version 12.
1. **GitHub Actions has produced no run** for this PR across every push.
2. **No preview exists for `apps/web`.** Vercel builds `arq-website` only, so
   the delivery stop's verified preview has nothing to verify for the code being
   changed.

## Standing blockers

Neither clears by implementing more; both are owner actions. Recorded here so no
slice is marked `verified` on their account, and so the absence is never
presented as a pass.

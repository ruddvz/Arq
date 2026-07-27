# @arq/marketing

The public website: all seventeen PUB sheets from `docs/pages/` (PUB-001
marketing home through PUB-017 open-source notices) plus a 404, rendered as
static HTML from typed page modules. No framework, no client-side JavaScript,
no third-party requests — the pages work with JavaScript disabled, in dark
mode via `prefers-color-scheme`, at 320 px, and at 200 % zoom.

## Commands

- `pnpm build` — compile with `tsc` and render the site into `dist/`
  (regenerates the dependency SBOM first if missing, so the open-source
  notices page is always current).
- `pnpm dev` — build, then preview on <http://localhost:4173> with a
  zero-dependency static server that mirrors static-host routing (including
  404 behaviour).
- `pnpm typecheck` — strict TypeScript over the sources.
- Tests run in the repository suite (`pnpm test` at the root):
  `src/pages.test.ts` enforces the shared PUB acceptance criteria (one `h1`,
  skip link, landmarks, meta/OG tags, resolvable internal links, no external
  resources) and turns `business/LAUNCH-CLAIMS-CHECKLIST.md` into a failing
  test for any affirmative sensitive claim.

## Design

One aesthetic commitment: the site is composed like an architectural drawing
set. Sheet numbers (the PUB ids) appear in a title-block footer, section
headings are numbered general notes, hairline rules carry dimension ticks,
and the only colour is the brand's phthalo green. Typefaces are the two
families `docs/design/DESIGN-SYSTEM.md` names — Plus Jakarta Sans and
JetBrains Mono — self-hosted from `assets/fonts/` (SIL OFL 1.1, see the
LICENCE note there). Brand favicons, manifest and wordmarks are copied from
`brand/` at build time; nothing brand-owned is duplicated into this app.

## Honesty rules

Copy follows `docs/product/PRODUCT-COPY-PRINCIPLES.md` and
`marketing/BRAND-VOICE.md`. Pages that depend on undecided upstream facts
(pricing, legal, status) publish the state of the decision rather than
placeholder fiction, and say what will change when the decision lands. The
route map and format-support table are mirrored from their source documents
and covered by tests so they cannot silently drift.

## Known limits

- No analytics: the PUB specs allow "standard web analytics only"; none is
  wired because no provider has been chosen. The privacy page states this.
- No sitemap by default: a sitemap needs absolute URLs and no domain has been
  cleared (`remaining/REMAINING-WORK.md`). Set `SITE_ORIGIN` at build time to
  emit one.
- AUTH-001..005 and the `/app` surfaces belong to the product, not this site,
  and are intentionally absent here.

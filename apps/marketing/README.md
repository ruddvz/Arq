# @arq/marketing

The public website: all seventeen PUB sheets from `docs/pages/` (PUB-001
marketing home through PUB-017 open-source notices) plus a 404, rendered as
static HTML from typed page modules. No framework, no client-side JavaScript,
no third-party requests. The pages work with JavaScript disabled, in dark
mode via `prefers-color-scheme`, at 320 px, and at 200% zoom.

## Commands

- `pnpm build` compiles with `tsc` and renders the site into `dist/`
  (regenerates the dependency SBOM first if missing, so the open-source
  notices page is always current).
- `pnpm dev` builds, then previews on <http://localhost:4173> with a
  zero-dependency static server that mirrors static-host routing, including
  404 behaviour.
- `pnpm typecheck` runs strict TypeScript over the sources.
- Tests run in the repository suite (`pnpm test` at the root):
  `src/pages.test.ts` enforces the shared PUB acceptance criteria (one `h1`,
  skip link, landmarks, meta/OG tags, resolvable internal links, no external
  resources) and turns `business/LAUNCH-CLAIMS-CHECKLIST.md` into a failing
  test for any affirmative sensitive claim.

## Design

The original public set is composed like an architectural drawing set. Sheet
numbers (the PUB ids) appear in the footer, hairline rules carry drafting
structure, and phthalo green is the only brand accent. Typefaces are the two
families `docs/design/DESIGN-SYSTEM.md` names: Plus Jakarta Sans and JetBrains
Mono, self-hosted from `assets/fonts/` (SIL OFL 1.1, see the LICENCE note
there). Brand favicons, manifest and wordmarks are copied from `brand/` at
build time; nothing brand-owned is duplicated into this app.

The public-site v2 migration adds an editorial composition layer without
replacing those contracts. `src/editorial.css` is additive while pages migrate
one by one, and `src/editorial-components.ts` contains typed public-only
composition primitives. The static build copies `design/tokens/brand.v4.css`
directly to the output, so marketing consumes the canonical brand tokens
instead of maintaining a second accent definition. These editorial tokens and
large display compositions are marketing-only and are not a second product UI
design system.

## Honesty rules

Copy follows `docs/product/PRODUCT-COPY-PRINCIPLES.md` and
`marketing/BRAND-VOICE.md`. Pages that depend on undecided upstream facts
(pricing, legal, status) publish the state of the decision rather than
placeholder fiction, and say what will change when the decision lands. The
route map and format-support table are mirrored from their source documents
and covered by tests so they cannot silently drift.

Claim-bearing visuals follow the same rule as claim-bearing prose: a visual
must not imply that planned, library-only or unverified behaviour is current.
Decorative diagrams must be identifiable as diagrams, and product captures
must come from user-reachable repository state rather than fabricated screens.

## Known limits

- No analytics: the PUB specs allow "standard web analytics only"; none is
  wired because no provider has been chosen. The privacy page states this.
- No sitemap by default: a sitemap needs absolute URLs and no domain has been
  cleared (`remaining/REMAINING-WORK.md`). Set `SITE_ORIGIN` at build time to
  emit one.
- AUTH-001..005 and the `/app` surfaces belong to the product, not this site,
  and are intentionally absent here.

# Arq brand implementation specification v4.0

## Canonical identity assets

The only canonical production logo files are under `brand/`, laid out as
`00_GUIDE/` (usage PDFs), `01_VECTOR/` (SVG/PDF masters), `02_4K_PNG/`,
`03_WEB/` (favicons, PWA icons, Open Graph), `04_APP_ICONS/` and
`05_PRINT/`:

Primary colours:

- Black: `#000000`
- White: `#FFFFFF`
- Phthalo Green: `#0B6B50`

Minimum sizes:

- Wordmark: 64 px / 18 mm
- Symbol: 24 px / 7 mm
- Tagline lockup: 360 px / 90 mm

## Product usage

- Public website header: black wordmark on white; white wordmark on black.
- App shell: symbol where horizontal space is restricted; wordmark on dashboards.
- Loading, empty and launch states: symbol may be centred, never stretched.
- Favicon and PWA: use the supplied files, not an improvised letter.
- Print: use the supplied CMYK PDFs and obtain the printer's ICC profile for large runs.

## Green accent rule

Arq remains a predominantly monochrome product. Phthalo Green is reserved for:

- focus rings;
- active mode or selected state;
- primary success confirmation;
- brand-led calls to action;
- links where colour is not the only differentiator.

Do not colour every icon, toolbar or panel green.

## Prohibited changes

- Do not redraw the wordmark.
- Do not type “Arq” as a substitute where the final wordmark should appear.
- Do not change spacing between the a and q.
- Do not add gradients, shadows, outlines or bevels to the logo.
- Do not crop clear-space versions.
- Do not stretch or recolour raster exports.
- Do not use unapproved green values.

## Accessibility

The logo does not replace a textual accessible name. Interactive logo links require
an accessible label such as “Arq home.”

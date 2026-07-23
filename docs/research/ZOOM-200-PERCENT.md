# 200% browser zoom (ARQ-154)

## Purpose

Blueprint section 126 ("Baseline")'s accessibility requirement "200% browser
zoom" - a low-vision user turning on the browser/OS's own page zoom, distinct
from the editor's own canvas pan/zoom (`Viewport.pixelsPerUnit`).

## What is covered here

This repository has no real page/canvas-mounting shell yet (no `apps/`
package renders an actual DOM page), so there is nothing to screenshot-test
at 200% browser zoom in the usual sense. What genuinely exists and is
zoom-sensitive is the canvas rendering math itself:

- **Line weight stability** (`line-weight.ts`, ARQ-120) already promises a
  line's weight tier stays crisp and does not blur or vanish "as the device
  pixel ratio changes" - exactly what 200% browser zoom depends on, since the
  standard way a canvas stays sharp under browser zoom is scaling its backing
  store by `window.devicePixelRatio`, which zoom increases.
  `packages/plan-renderer/src/zoom-200-percent.test.ts` verifies this
  explicitly at `devicePixelRatio` 2 (a typical 200%-zoom value) and, via a
  fast-check property, across the whole 100%-400% zoom range: every tier
  stays at or above 1 device pixel, and the five-tier hierarchy stays
  strictly monotonic throughout.
- **Coordinate round-trip correctness** (`coordinate-system.ts`, ARQ-032):
  200% browser zoom means the same physical screen area now presents fewer
  CSS pixels to the page (a halved effective viewport). The same test file
  verifies `worldToScreen`/`screenToWorld` still round-trip exactly under a
  halved viewport, and via a property test, across any viewport size/scale a
  browser zoom level between 50% and 400% could plausibly produce.

## What is not yet testable

Section 126's actual concern is broader than canvas math: does the whole page
layout (panels, toolbars, text, the inspector) remain usable, unclipped, and
free of forced horizontal scrolling at 200% zoom? That requires a real
rendered UI shell (HTML/CSS, actual components) to test against, which does
not exist in this repository yet. This is recorded honestly as a gap, not
worked around by fabricating layout tests against non-existent markup - the
same "do not expand into later release scope" discipline every issue in this
backlog follows.

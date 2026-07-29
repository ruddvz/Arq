---
name: zeus-product-ux
description: Use for Arq interface design, information architecture, panels, toolbars, onboarding, states, responsive behaviour or pixel-precise implementation.
---

# zeus-product-ux

Cover every state: empty, loading, partial, error, offline, read-only, permission
limited. Route `arq-ux-accessibility-reviewer` before calling a surface finished.

## Source of truth

`.zeus/modules/ui-visual.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

LENSSTACK, SCAMPER, /simulate. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

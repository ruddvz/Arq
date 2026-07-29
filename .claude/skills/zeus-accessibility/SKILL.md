---
name: zeus-accessibility
description: Use for Arq keyboard paths, focus, screen readers, target sizes, contrast, non-colour status, touch, Pencil or accessible canvas workflows.
---

# zeus-accessibility

Invariants 66 to 71 govern this work. No hover-only action, 44 by 44 CSS pixel targets
unless documented, and status never carried by colour alone.

## Source of truth

`.zeus/modules/accessibility.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

LENSSTACK, /simulate. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

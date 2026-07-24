# CMP-069: Compare legend

## Purpose

Explain added, modified and deleted objects.

## Anatomy

- Colour/pattern key mapping to added/modified/deleted
- Optional counts per category

## Required states

- Visible alongside an active compare view

## Behaviour

- Only appears alongside a real active compare operation - never shown standalone with nothing to explain.
- Never relies on colour alone to distinguish added/modified/deleted - each category also has a distinct pattern/glyph, since this is exactly the kind of comparison a colourblind user must be able to read correctly.

## Sizing

- Compact, fixed position near the compare view it explains.

## Keyboard and accessibility

- Not independently focusable; purely explanatory, read by screen readers as ordinary text alongside the compare view's own live region.

## Acceptance criteria

- [ ] Never appears without an active compare view to explain.
- [ ] Categories are distinguishable without relying on colour alone.

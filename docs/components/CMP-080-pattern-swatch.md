# CMP-080: Pattern swatch

## Purpose

Select a monochrome pattern.

## Anatomy

- Small preview swatch of a monochrome hatch/fill pattern
- Selection indicator

## Required states

- Default
- Hover
- Focus visible
- Selected

## Behaviour

- Distinguishes patterns by their actual visual density/texture, not colour, since these are explicitly monochrome patterns meant to remain legible on any material colour underneath.

## Sizing

- Fixed small square/rect per swatch in a grid; hit target still meets 44pt on iPad even though the visual swatch is smaller.

## Keyboard and accessibility

- Arranged as a roving-tabindex grid (arrow keys move selection, matching CMP-020's single-Tab-stop pattern); Enter/Space selects the focused swatch.

## Acceptance criteria

- [ ] Every pattern remains distinguishable purely by its texture, independent of colour.
- [ ] Full keyboard grid navigation works without a pointer.

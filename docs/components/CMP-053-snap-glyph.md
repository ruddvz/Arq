# CMP-053: Snap glyph

## Purpose

Show active snap type and source.

## Anatomy

- Small glyph indicating the active snap type (endpoint, midpoint, intersection, grid, etc.) and its source object where applicable

## Required states

- Hidden (no active snap)
- Visible per snap type (one glyph shape per type)

## Behaviour

- Each snap type (matching `packages/editor-shell`'s real snap implementations - grid, midpoint, and the rest) has a visually distinct glyph, not one generic "snapped" indicator.
- Disappears immediately once the pointer moves off the snap point - never lingers stale.

## Sizing

- Small, fixed size independent of canvas zoom, so it stays legible at any zoom level.

## Keyboard and accessibility

- Purely visual feedback for an in-progress pointer operation; keyboard-driven precise entry uses CMP-054 Numeric overlay instead, which states the same information as accessible text.

## Acceptance criteria

- [ ] Each real snap type has its own distinct glyph, verified against the actual set of snap implementations in `packages/editor-shell`.
- [ ] Never shows a stale snap indicator after the pointer moves away.

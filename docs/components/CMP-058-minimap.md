# CMP-058: Minimap

## Purpose

Navigate a large plan later.

## Anatomy

- Small proportional overview of the full plan
- Viewport rectangle showing the current visible region

## Required states

- Default
- Dragging the viewport rectangle (panning the main view)

## Behaviour

- Explicitly deferred: this repo's own `docs/platform/*` plans mark large-plan navigation aids as "later," not yet implemented - this doc describes the intended contract for when it is built, not a claim that it exists today.
- When built, dragging the viewport rectangle pans the main canvas live, and the main canvas panning likewise updates the rectangle live (bidirectional, not one-way).

## Sizing

- Small, fixed corner placement; never obscures a meaningful portion of the main canvas.

## Keyboard and accessibility

- When built, a documented shortcut toggles its visibility; the viewport rectangle itself is not required to be keyboard-draggable since CMP-049's own keyboard pan already covers that need.

## Acceptance criteria

- [ ] This component's absence from the shipped application is correctly reflected as "not yet built" rather than claimed complete.
- [ ] When built: viewport-rectangle drag and main-canvas pan stay bidirectionally synchronised.

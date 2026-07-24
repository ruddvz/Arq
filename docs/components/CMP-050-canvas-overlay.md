# CMP-050: Canvas overlay

## Purpose

Host transient controls and warnings.

## Anatomy

- Transparent layer above the canvas hosting transient controls/warnings that must track canvas coordinates

## Required states

- Empty (nothing to show)
- Showing one or more transient controls/warnings

## Behaviour

- Purely additive over CMP-049 Canvas - never itself receives pointer events meant for the canvas beneath it except on its own explicit controls.
- Content here tracks canvas pan/zoom exactly, never drifting out of alignment with the geometry it annotates.

## Sizing

- Exactly matches the canvas's own bounds and transform at all times.

## Keyboard and accessibility

- Any interactive control hosted here (e.g. an inline confirm) is independently reachable by Tab, not swallowed by the canvas's own keyboard handling.

## Acceptance criteria

- [ ] Overlay content never drifts out of alignment with canvas geometry during pan/zoom.
- [ ] Non-interactive regions of the overlay never intercept pointer events meant for the canvas.

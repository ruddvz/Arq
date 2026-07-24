# CMP-025: Tooltip

## Purpose

Explain a control or shortcut.

## Anatomy

- Trigger element
- Non-interactive text content

## Required states

- Hidden
- Visible (on hover or focus)

## Behaviour

- Purely informative - never contains an interactive control and never conveys information unavailable elsewhere (a tooltip is a supplement, not the only source of a required fact).
- Appears on both hover and keyboard focus, and on long-press on touch devices - it is never pointer-only.
- Disappears on Escape, on blur, or when the trigger is no longer hovered, whichever comes first.

## Sizing

- Sized to its (short) text content; wraps rather than overflowing the viewport near an edge.

## Keyboard and accessibility

- Escape dismisses it without moving focus away from the trigger.

## Acceptance criteria

- [ ] Appears on keyboard focus, not just pointer hover.
- [ ] Never the sole source of information required to use the associated control.
- [ ] Contains no interactive content.

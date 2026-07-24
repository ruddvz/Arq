# CMP-028: Bottom sheet

## Purpose

Show secondary iPad portrait content.

## Anatomy

- Drag handle
- Title
- Body content
- Optional actions
- Scrim below the sheet

## Required states

- Closed
- Peek (partially visible, collapsed)
- Open (fully expanded)
- Dragging (mid-gesture)

## Behaviour

- iPad-portrait-specific secondary surface, replacing CMP-027 Drawer where a side panel would not fit the portrait layout.
- Drag handle supports both a full swipe-to-dismiss gesture and a tap-to-toggle between peek and open, so it is never gesture-only.
- Settles into exactly one of its defined snap positions (peek/open/closed) after a drag ends - never left at an arbitrary partial height.

## Sizing

- Peek height and open height are each fixed per breakpoint, not proportional to unrelated content changes.

## Keyboard and accessibility

- When a hardware keyboard is attached, Escape closes it and a documented shortcut toggles peek/open, so it is not touch-gesture-only even on iPad.

## Acceptance criteria

- [ ] Settles into a defined snap position after every drag, never an arbitrary height.
- [ ] Fully operable by tap alone (no gesture-only dead ends) and by keyboard when a hardware keyboard is attached.

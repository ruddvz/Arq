# CMP-023: Context menu

## Purpose

Show pointer-context actions.

## Anatomy

- Popup list of actions relevant to the right-clicked/long-pressed target
- Optional icons/shortcuts per item

## Required states

- Closed
- Open at pointer/touch position
- Item focused
- Item disabled with reason

## Behaviour

- Content is entirely derived from what was right-clicked/long-pressed - it has no fixed content of its own like CMP-022 does.
- Opens anchored to the pointer/touch position (not a fixed trigger element), clamped to stay fully within the viewport.
- On iPad, a long-press opens it in place of the desktop right-click gesture, with the same content rules.

## Sizing

- Same popup sizing rule as CMP-022 (fits content, scrolls internally, clamped to viewport).

## Keyboard and accessibility

- The equivalent keyboard-accessible entry point is the platform "context menu" key or Shift+F10 on the currently-selected/focused object, so this menu is never pointer-only.
- Once open, keyboard navigation matches CMP-022 exactly (arrows, type-ahead, Escape, focus return).

## Acceptance criteria

- [ ] A keyboard-only path to open the same menu exists and is discoverable (documented shortcut), not pointer/touch-only.
- [ ] Menu position is always fully within the viewport, never clipped off-screen.
- [ ] Focus returns to the triggering selection after close.

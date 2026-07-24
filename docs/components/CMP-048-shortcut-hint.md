# CMP-048: Shortcut hint

## Purpose

Display a platform-aware shortcut.

## Anatomy

- One or more key glyphs (e.g. platform-correct modifier symbols)
- Optional connecting "+" or spacing convention

## Required states

- Visible

## Behaviour

- Renders the platform-correct modifier glyphs (e.g. Cmd/Option on macOS/iPadOS vs Ctrl/Alt elsewhere) rather than one hard-coded convention everywhere.
- Purely informative; never itself an interactive trigger for the shortcut it describes.

## Sizing

- Compact inline element sized to sit naturally inside a menu item, tooltip, or button without disrupting that container's row height.

## Keyboard and accessibility

- Not focusable; purely decorative/informative text for sighted and screen-reader users alike (the latter via a real text equivalent, not an image of the keys).

## Acceptance criteria

- [ ] Renders the correct platform-specific modifier glyphs per platform.
- [ ] Announces as real text to screen readers, not as an unlabelled image.

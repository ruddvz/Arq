# CMP-003: Split button

## Purpose

Offer a primary action and related menu.

## Anatomy

- Primary action segment
- Divider
- Disclosure segment (opens CMP-022 Menu)
- Accessible names for both segments

## Required states

- Default
- Hover (per segment)
- Focus visible (per segment)
- Active/pressed (per segment)
- Disabled with reason
- Menu open

## Behaviour

- The primary segment always performs the single most common action; the disclosure segment only ever opens the related menu, never a second action.
- Opening the menu does not trigger the primary action.
- Disabling the whole control disables both segments together; a partially-disabled split button is not supported (ambiguous for screen readers).

## Sizing

- Both segments meet the 44pt iPad hit target independently, with a visible divider at least 1px wide between them.

## Keyboard and accessibility

- Tab moves between the two segments as separate stops.
- Down Arrow (or Enter/Space) on the disclosure segment opens the menu with focus on its first item.
- Escape closes the menu and returns focus to the disclosure segment.

## Acceptance criteria

- [ ] Primary and disclosure segments are independently reachable and labelled for assistive technology.
- [ ] Opening the menu never fires the primary action as a side effect.
- [ ] Keyboard-only users can open, navigate and dismiss the menu without a pointer.

# CMP-022: Menu

## Purpose

Show contextual actions.

## Anatomy

- Trigger (usually a button)
- Popup list of actions/options
- Optional icons/shortcuts per item
- Optional separators/groups

## Required states

- Closed
- Open
- Item focused
- Item disabled with reason
- Submenu open (nested menu)

## Behaviour

- Opens anchored to its trigger and closes on: item activation, Escape, or an outside click/tap.
- A disabled menu item states why via an adjacent hint or `aria-describedby`, and is never silently removed (removing it would make the menu's shape unpredictable).

## Sizing

- Popup width fits its longest item label; height scrolls internally rather than growing past the visible viewport.

## Keyboard and accessibility

- Enter/Space/Down Arrow on the trigger opens the menu with the first item focused.
- Arrow Up/Down moves focus between items; Right Arrow opens a submenu, Left Arrow closes it and returns to the parent item.
- Escape closes the (sub)menu and returns focus to its trigger.
- Type-ahead jumps to the next item starting with the typed character.

## Acceptance criteria

- [ ] Full keyboard operation (open, navigate, submenu, activate, escape) works without a pointer.
- [ ] Focus returns to the trigger after every close path, matching the exact focus-return defect already found and fixed in the static prototype (issue ARQ-211/#211).
- [ ] Disabled items state why rather than disappearing.

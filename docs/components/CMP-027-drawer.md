# CMP-027: Drawer

## Purpose

Show secondary desktop content.

## Anatomy

- Overlay/scrim (optional, may allow background interaction depending on use)
- Slide-in panel from a screen edge
- Title
- Body content
- Optional actions

## Required states

- Closed
- Open
- Resizing (if the drawer supports a draggable edge)

## Behaviour

- Desktop-oriented secondary surface (e.g. detailed inspector or history panel) that does not block the whole canvas the way a Dialog does, unless explicitly configured as modal for a specific flow.
- Remembers its last width/open-state per surface within a session, rather than resetting every time it is reopened.

## Sizing

- Has a documented minimum and maximum width if resizable; below the minimum it should behave like CMP-028 Bottom sheet instead (that is a distinct component, not this one shrunk down).

## Keyboard and accessibility

- Escape closes it (if dismissable) and returns focus to its trigger.
- If configured modal for a specific flow, follows the same focus-trap rule as CMP-026 Dialog; if non-modal, follows CMP-024 Popover's non-trapping rule instead.

## Acceptance criteria

- [ ] Open/width state persists correctly across reopen within a session.
- [ ] Focus-trap behaviour matches whichever mode (modal or non-modal) this specific drawer instance actually uses - never ambiguous.

# CMP-024: Popover

## Purpose

Show non-modal contextual content.

## Anatomy

- Trigger
- Non-modal popup content region
- Optional close affordance

## Required states

- Closed
- Open
- Focus within

## Behaviour

- Non-modal: unlike CMP-026 Dialog, the rest of the page remains interactive while a popover is open, and it closes on outside interaction rather than blocking it.
- Positions itself relative to its trigger and repositions/flips if it would otherwise render off-screen.

## Sizing

- Sized to its content up to a sensible maximum width/height; scrolls internally beyond that rather than growing unbounded.

## Keyboard and accessibility

- Escape closes it and returns focus to the trigger.
- Tab moves through its internal focusable content; Tab out of the last item closes it and continues into the page's normal tab order (a popover never traps focus - that is Dialog's job).

## Acceptance criteria

- [ ] Does not trap focus, unlike a Dialog - Tab can leave it into the rest of the page.
- [ ] Repositions to stay fully visible regardless of trigger location near a viewport edge.
- [ ] Escape closes and restores focus to the trigger.

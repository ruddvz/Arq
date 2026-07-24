# CMP-030: Banner

## Purpose

Show persistent page-level status.

## Anatomy

- Icon (matching severity)
- Message text
- Optional action
- Optional dismiss control

## Required states

- Visible (info/warning/error severity)
- Dismissed (if dismissable)

## Behaviour

- Persistent page-level status - unlike CMP-029 Toast, it does not auto-dismiss and remains visible until the underlying condition resolves or the user dismisses it.
- Only shown for a condition that is genuinely page-level (affects the whole current view), not a single-object issue - that belongs in CMP-031 Inline validation instead.

## Sizing

- Spans the width of its containing surface; height grows with message length rather than truncating a fact the user needs to act on.

## Keyboard and accessibility

- Its optional dismiss control and action are reachable by Tab in document order; no focus-trap behaviour, since it never blocks the rest of the page.

## Acceptance criteria

- [ ] Remains visible until the underlying condition genuinely resolves, not on a timer.
- [ ] Announced via `aria-live="polite"` on appearance.
- [ ] Never used for a single-object issue that belongs in Inline validation instead.

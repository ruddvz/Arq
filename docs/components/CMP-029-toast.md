# CMP-029: Toast

## Purpose

Announce transient result.

## Anatomy

- Icon (optional, matching severity)
- Message text
- Optional single action (e.g. Undo)
- Auto-dismiss timer

## Required states

- Visible
- Visible with action
- Dismissing (exit animation)

## Behaviour

- Transient and non-blocking - never requires acknowledgement to continue working, and never contains more than one action.
- Auto-dismisses after a fixed duration unless the user is actively hovering/focused on it (e.g. reading it or about to click Undo), in which case the timer pauses.
- Multiple toasts queue rather than overlapping or replacing one another before being seen.

## Sizing

- Fixed maximum width; message text wraps rather than truncating a fact the user needs.

## Keyboard and accessibility

- Never steals focus on appearance; its optional action (if present) is reachable by Tab for as long as the toast remains visible, and Escape dismisses it early.

## Acceptance criteria

- [ ] Never steals focus when it appears.
- [ ] Timer pauses on hover/focus and resumes correctly.
- [ ] Announced via `aria-live="polite"` so it is not missed by screen reader users without stealing their focus.

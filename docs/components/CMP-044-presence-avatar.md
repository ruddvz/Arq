# CMP-044: Presence avatar

## Purpose

Show collaborator identity and state.

## Anatomy

- Initials or photo
- Presence indicator (online/idle/offline)
- Optional colour keyed to the collaborator

## Required states

- Online
- Idle
- Offline
- Focus visible (when interactive, e.g. in CMP-043)

## Behaviour

- Presence state reflects the real current connection status of that specific collaborator, updating live rather than on a stale snapshot.
- Colour keying alone never distinguishes collaborators for accessibility purposes - initials/photo plus an accessible name (real person's name) always accompany it.

## Sizing

- Fixed circular/rounded size per usage context (e.g. smaller stacked in a group, larger standalone in CMP-043).

## Keyboard and accessibility

- Not independently focusable unless it is itself a trigger (e.g. within CMP-043); otherwise purely decorative with an accessible name via `alt`/`aria-label`.

## Acceptance criteria

- [ ] Presence state updates live and never shows a stale status.
- [ ] A real accessible name (not colour alone) identifies the collaborator.

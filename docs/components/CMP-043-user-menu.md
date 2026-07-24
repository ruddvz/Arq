# CMP-043: User menu

## Purpose

Access account and sign-out actions.

## Anatomy

- Avatar/initials trigger (delegates to CMP-044 for rendering)
- Popup menu (delegates to CMP-022) with account and sign-out actions

## Required states

- Closed
- Open

## Behaviour

- Sign-out always confirms first if there is any genuinely unsaved local state that would be lost, otherwise proceeds immediately.

## Sizing

- Trigger meets the 44pt iPad hit target like any icon-style trigger.

## Keyboard and accessibility

- Follows CMP-022 Menu's keyboard contract exactly.

## Acceptance criteria

- [ ] Sign-out never silently discards genuinely unsaved local state.
- [ ] Full keyboard operation matches CMP-022's contract.

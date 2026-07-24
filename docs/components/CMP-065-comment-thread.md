# CMP-065: Comment thread

## Purpose

Discuss and resolve feedback.

## Anatomy

- Ordered list of comments
- Author + timestamp per comment
- Reply input
- Resolve/reopen action

## Required states

- Open (unresolved)
- Resolved
- Composing a reply

## Behaviour

- Resolving is a real, auditable state change (visible in CMP-067 History timeline), not merely hiding the thread from view.
- A reopened thread keeps its full prior comment history intact, never truncated by the resolve/reopen cycle.

## Sizing

- Scrolls internally for long threads; reply input stays pinned and visible at the bottom.

## Keyboard and accessibility

- Reply input follows CMP-011 Text field's contract; Resolve/reopen is a normal focusable button.

## Acceptance criteria

- [ ] Resolve/reopen is a real, auditable state change, not a visual-only hide.
- [ ] Full comment history survives a resolve/reopen cycle intact.

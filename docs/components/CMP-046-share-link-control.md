# CMP-046: Share link control

## Purpose

Create and revoke controlled links.

## Anatomy

- Current link (if one exists) with copy action
- "Create link" action
- Access-level control (view/comment/edit)
- "Revoke" action for existing links

## Required states

- No link exists yet
- Link exists
- Just copied (transient confirmation)
- Revoking (confirm step)

## Behaviour

- Revoking a link is a real permission change with immediate effect on anyone holding the old link - it always requires an explicit confirm step, never a single accidental click.
- Copy action gives clear, brief transient confirmation (matches CMP-029 Toast's pattern) rather than silent success.

## Sizing

- Compact, typically hosted inside CMP-024 Popover or CMP-026 Dialog rather than a standalone full page.

## Keyboard and accessibility

- Every action (create, copy, change access level, revoke) is an independent, labelled Tab stop.

## Acceptance criteria

- [ ] Revoke always requires an explicit confirm step.
- [ ] Copy gives real, perceivable confirmation, not silent success.

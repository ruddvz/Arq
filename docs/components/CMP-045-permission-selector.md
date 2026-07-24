# CMP-045: Permission selector

## Purpose

Assign a role.

## Anatomy

- List of assignable roles
- Currently-assigned role indicator
- Optional description of what each role can do

## Required states

- Default
- Open (choosing a new role)
- Disabled with reason (e.g. cannot demote the last owner)

## Behaviour

- Never allows removing the last remaining owner/admin from a workspace/project - that specific option is disabled with a stated reason rather than allowed and failing later.
- Shows what each role can actually do (delegates to real RBAC data, not a static description that could drift from the truth).

## Sizing

- Follows CMP-014 Select's sizing where rendered as a dropdown, or a radio-group's sizing (CMP-017) where rendered as a list with descriptions.

## Keyboard and accessibility

- Follows CMP-014 or CMP-017's keyboard contract depending on which visual form this instance uses.

## Acceptance criteria

- [ ] Cannot produce a workspace/project with zero owners/admins under any interaction path.
- [ ] Role descriptions shown always match the real current RBAC rules, not a stale hard-coded copy.

# CMP-077: AI operation row

## Purpose

Show one proposed typed change.

## Anatomy

- Operation type/description
- Affected object reference
- Accept/reject controls
- Optional confidence/fidelity indicator

## Required states

- Pending review
- Accepted
- Rejected

## Behaviour

- States plainly what will change and to which real object - never a vague description that could apply to multiple different real edits.
- Rejecting one operation never affects the accept/reject state of any other operation in the same proposal (CMP-076).

## Sizing

- Fits as a row within CMP-076's list; wraps rather than truncating the operation description.

## Keyboard and accessibility

- Accept/reject are independent, labelled Tab stops within the row, each activatable by Enter/Space.

## Acceptance criteria

- [ ] Operation description is specific enough to identify the exact real change and object.
- [ ] Accept/reject of one operation never affects any sibling operation's state.

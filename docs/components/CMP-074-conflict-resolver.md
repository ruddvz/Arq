# CMP-074: Conflict resolver

## Purpose

Resolve incompatible operations.

## Anatomy

- Description of the conflicting operations
- Options for resolution (e.g. keep mine / keep theirs / merge where possible)
- Preview of the outcome before committing

## Required states

- Unresolved conflict presented
- Previewing a chosen resolution
- Resolved

## Behaviour

- Never silently auto-resolves a genuine conflict in a way that could discard someone's real work without their explicit choice.
- Shows a real preview of the outcome before the user commits to a resolution, not just an abstract description of the options.

## Sizing

- Typically hosted in CMP-026 Dialog given the significance of the decision; sized to that dialog's content rules.

## Keyboard and accessibility

- Follows CMP-026 Dialog's keyboard contract; each resolution option is an independent, labelled Tab stop.

## Acceptance criteria

- [ ] Never auto-resolves a genuine conflict without explicit user choice.
- [ ] A real preview of the outcome is shown before commit, not just an abstract description.

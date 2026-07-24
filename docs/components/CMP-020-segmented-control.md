# CMP-020: Segmented control

## Purpose

Choose a compact mode.

## Anatomy

- Set of 2-4 mutually exclusive compact options rendered as connected buttons

## Required states

- Default
- Hover (per segment)
- Focus visible (per segment)
- Selected segment
- Disabled with reason (whole control or one segment)

## Behaviour

- Exactly one segment is selected at all times; selecting a new one deselects the previous immediately (this is a mode switch, not a multi-select).
- Reserved for a small, stable, well-known set of options (2-4) - a longer or dynamic option set should use Tabs (CMP-021) or Select (CMP-014) instead.

## Sizing

- Fixed total width for a given option set; segments divide that width evenly unless label length genuinely requires otherwise.

## Keyboard and accessibility

- Arrow Left/Right moves the actual selection between segments (roving tabindex, single Tab stop overall), matching radio-group semantics.

## Acceptance criteria

- [ ] Exactly one segment is selected at all times; arrow keys move the real selection.
- [ ] The whole control is a single Tab stop.

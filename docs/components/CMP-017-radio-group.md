# CMP-017: Radio group

## Purpose

Choose one exclusive option.

## Anatomy

- Group label
- Set of mutually exclusive radio options
- Optional per-option helper text

## Required states

- Default (one option selected)
- Focus visible (on the focused option)
- Disabled with reason (whole group or a single option)
- Invalid (group-level, e.g. required but unanswered)

## Behaviour

- Exactly one option is selected within the group at all times once a default exists.
- A single disabled option within an otherwise-enabled group states why that specific option is unavailable.

## Sizing

- Options stack vertically by default; a compact horizontal layout is allowed only when there are two options and space is tight.

## Keyboard and accessibility

- Arrow Up/Down (or Left/Right if horizontal) moves selection between options directly - the group is a single Tab stop, matching native radio-group semantics.
- Tab enters/exits the whole group at the currently-selected option.

## Acceptance criteria

- [ ] The group is a single Tab stop; arrow keys move the actual selection, not just visual focus.
- [ ] A per-option disabled reason is exposed via `aria-describedby` on that option.

# CMP-011: Text field

## Purpose

Enter text.

## Anatomy

- Label
- Input
- Optional helper text
- Optional inline validation (CMP-031)
- Optional character/length indicator

## Required states

- Default
- Focus
- Filled
- Disabled with reason
- Invalid
- Read-only

## Behaviour

- Validates on blur/commit, not on every keystroke, so the user is not shown an error while still mid-typing a valid value.
- Read-only differs from disabled: read-only text remains selectable/copyable; disabled communicates "cannot be edited here at all."

## Sizing

- Width follows its container/grid; height follows the field-height token shared by every text-style input in this list.

## Keyboard and accessibility

- Standard native text-input editing keys; no custom key interception beyond Enter committing (where applicable) and Escape reverting an uncommitted edit.

## Acceptance criteria

- [ ] Validates on blur/commit, not per-keystroke.
- [ ] Read-only and disabled are visually and programmatically distinct.
- [ ] Invalid state links its error text via `aria-describedby`.

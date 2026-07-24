# CMP-014: Select

## Purpose

Choose one option.

## Anatomy

- Label
- Trigger showing the current value
- Popup listbox of options

## Required states

- Default (closed)
- Open
- Focus
- Disabled with reason
- Invalid

## Behaviour

- Exactly one option is selected at all times once a default exists - there is no "nothing selected" state for a required select (an optional one shows an explicit placeholder option instead of a blank trigger).
- Opening the popup does not change the committed value until an option is actually chosen.

## Sizing

- Trigger height matches CMP-011; popup width is at least the trigger's width and grows to fit its longest option label.

## Keyboard and accessibility

- Enter/Space/Down Arrow opens the popup with the current selection focused.
- Arrow Up/Down moves focus within the open popup; type-ahead jumps to a matching option.
- Enter commits the focused option and closes the popup; Escape closes without changing the selection.

## Acceptance criteria

- [ ] Full keyboard operation (open, navigate, type-ahead, commit, cancel) works without a pointer.
- [ ] Escape never leaves a partially-changed selection.
- [ ] Native `<select>` semantics are used where the platform allows it, matching a real listbox pattern otherwise.

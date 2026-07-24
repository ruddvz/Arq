# CMP-015: Combobox

## Purpose

Search and choose an option.

## Anatomy

- Label
- Editable text input
- Popup listbox of filtered suggestions
- Optional "create new" affordance

## Required states

- Empty
- Typing (filtering)
- Open with suggestions
- No matches (optionally offers "create new")
- Selected
- Disabled with reason
- Invalid

## Behaviour

- Filters the option list against the typed text; does not require an exact match unless the field explicitly restricts to existing values.
- If free text is not a valid final value, the field rejects commit of unmatched text with a stated reason rather than silently accepting it.

## Sizing

- Same as CMP-014's trigger height; popup matches CMP-014's sizing rule.

## Keyboard and accessibility

- Typing filters the popup live; Arrow Down moves focus from the input into the filtered list without closing it.
- Enter commits the highlighted suggestion (or the typed text, if free text is allowed); Escape closes without committing a change.

## Acceptance criteria

- [ ] Filtering is case-insensitive and updates the popup on every keystroke without losing input focus.
- [ ] Free-text rejection (where applicable) states why, rather than silently ignoring the keystroke.
- [ ] Screen reader announces the live result count as filtering happens.

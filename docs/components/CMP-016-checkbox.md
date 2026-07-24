# CMP-016: Checkbox

## Purpose

Toggle independent selection.

## Anatomy

- Checkbox control
- Label (label click also toggles)
- Optional indeterminate glyph

## Required states

- Unchecked
- Checked
- Indeterminate (mixed children/partial selection)
- Focus visible
- Disabled with reason
- Invalid

## Behaviour

- Indeterminate is a distinct visual and programmatic state (`aria-checked="mixed"`), not just a differently-coloured checked box.
- Clicking the associated label toggles the checkbox exactly as clicking the box itself would (native `<label for>` association).

## Sizing

- Native control size follows the platform/token minimum, with the full label+box hit target at least 44pt tall on iPad.

## Keyboard and accessibility

- Space toggles; Tab moves to/from it in document order like any other form control.

## Acceptance criteria

- [ ] Indeterminate state is programmatically `aria-checked="mixed"`, not merely a visual approximation.
- [ ] Label click toggles the control.
- [ ] Space toggles when focused; no other key does.

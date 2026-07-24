# CMP-012: Numeric field

## Purpose

Enter unit-aware numeric values.

## Anatomy

- Label
- Unit-aware input (delegates to `packages/editor-shell`'s metric/imperial numeric-input parsers)
- Unit suffix/indicator
- Optional inline validation

## Required states

- Default
- Focus (raw editable value shown)
- Blurred/committed (formatted with unit)
- Disabled with reason
- Invalid (out of range or unparseable)

## Behaviour

- Accepts both metric and imperial input syntax regardless of the project's current display unit, parsing before commit (matches the real parser behaviour already implemented, not a new rule invented for this doc).
- An unparseable or out-of-range value is rejected at commit with an explicit reason, and the field reverts to its last valid committed value rather than silently accepting garbage.
- Displays in the project's current unit system on blur regardless of which system the user typed in.

## Sizing

- Same field-height token as CMP-011; width may be narrower than a general text field since numeric values are typically short.

## Keyboard and accessibility

- Up/Down arrow keys nudge the value by its unit's smallest sensible increment while focused.
- Enter commits; Escape reverts to the last committed value.

## Acceptance criteria

- [ ] Both metric and imperial input syntax are accepted and parsed correctly regardless of display unit.
- [ ] Out-of-range/unparseable input is rejected with a stated reason, not silently clamped.
- [ ] Up/Down arrow nudging respects the field's real unit increment, not a generic 1.

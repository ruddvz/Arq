# CMP-010: Property row

## Purpose

Show label, value, inheritance and validation.

## Anatomy

- Label
- Value control (delegates to the relevant input component)
- Inheritance indicator (from type/template vs overridden)
- Inline validation slot (CMP-031)

## Required states

- Default (own value)
- Inherited (from type/template, not overridden)
- Overridden (was inherited, now has its own value)
- Invalid
- Read-only

## Behaviour

- Inherited values are visually distinguished from overridden ones, and offer a "reset to inherited" action once overridden.
- An invalid value shows its inline validation immediately adjacent, never in a separate panel the user must find.
- Read-only rows still display the real current value - never blank just because it can't be edited here.

## Sizing

- Fixed label column width across all rows in one inspector so values align in a scannable column.

## Keyboard and accessibility

- Tab reaches the value control directly; label is not independently focusable.
- The "reset to inherited" action, when present, is reachable by Tab after the value control.

## Acceptance criteria

- [ ] Inherited vs overridden is programmatically determinable, not colour-only.
- [ ] Inline validation appears in the same row as its field, immediately on invalid commit.
- [ ] Reset-to-inherited restores the exact prior inherited value, not a stale cached one.

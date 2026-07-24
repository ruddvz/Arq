# CMP-031: Inline validation

## Purpose

Explain a field or object problem.

## Anatomy

- Icon
- Message text
- Association with its specific field/object via `aria-describedby`

## Required states

- Hidden (valid)
- Visible (invalid)

## Behaviour

- Always appears immediately adjacent to the specific field/object it describes, never in a separate summary-only location (that is CMP-032's distinct job).
- Message states the specific problem and, where possible, how to fix it - never a generic "Invalid value."

## Sizing

- Width matches its associated field; wraps rather than truncating.

## Keyboard and accessibility

- No independent keyboard interaction - it is programmatically linked to its field via `aria-describedby` so screen readers announce it automatically on focus.

## Acceptance criteria

- [ ] Every invalid field has an adjacent, specific (non-generic) message.
- [ ] `aria-describedby` correctly links the field to its message so it is announced automatically.

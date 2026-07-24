# CMP-009: Inspector

## Purpose

Edit and inspect selected object properties.

## Anatomy

- Selected-object type/name header
- Grouped property rows (CMP-010)
- Empty state for no/mixed selection

## Required states

- Empty (nothing selected)
- Single selection
- Multi-selection with mixed values
- Read-only (no permission to edit)

## Behaviour

- A mixed-value property across a multi-selection shows an explicit "Mixed" indicator, never a blank field or an arbitrarily-picked single value.
- Committing an edit applies to every selected object atomically - either all update or none do, never a partial batch.
- Read-only mode (no edit permission) disables inputs with a reason rather than hiding them, so the user still sees the object's real state.

## Sizing

- Resizable panel; property rows wrap rather than truncate their value where truncation would hide a decision-relevant number.

## Keyboard and accessibility

- Tab moves between property rows in visual order; each row's own control (CMP-011/012/014/016/etc.) owns its internal key handling.
- Escape in an editing field reverts that field's uncommitted edit without closing the inspector.

## Acceptance criteria

- [ ] Mixed-value state is visually and programmatically distinct from a real shared value.
- [ ] Multi-object commits are atomic - a rejected validation on one object rejects the whole edit, not a partial one.
- [ ] Read-only state is announced to assistive technology, not just visually dimmed.

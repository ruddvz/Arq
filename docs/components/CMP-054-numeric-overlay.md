# CMP-054: Numeric overlay

## Purpose

Enter distance and angle during a command.

## Anatomy

- Small floating input tracking the cursor during an active drawing command
- Distance and/or angle fields (unit-aware, delegates to CMP-012)

## Required states

- Hidden (no active command)
- Visible, tracking pointer
- Visible, value being typed (locks that axis to the typed value)

## Behaviour

- Lets a user type an exact distance/angle mid-command instead of relying on pointer precision alone - typing a value locks that dimension until the point is committed.
- Follows the exact same metric/imperial parsing rule as CMP-012 Numeric field - no separate, inconsistent parser for in-canvas entry.

## Sizing

- Small and positioned near the cursor without obscuring the point currently being placed.

## Keyboard and accessibility

- Tab (or a documented key) switches which field (distance vs angle) currently accepts typed input.
- Enter commits the point at the typed value(s); Escape cancels the current segment without discarding the command entirely.

## Acceptance criteria

- [ ] Uses the identical parsing rules as CMP-012, verified against the same test cases.
- [ ] Typed value takes precedence over pointer position for the locked axis until committed.

# CMP-066: Issue card

## Purpose

Track an actionable issue.

## Anatomy

- Title
- Status (open/in-progress/resolved)
- Assignee (delegates to CMP-044)
- Priority indicator
- Link to the affected model/sheet location

## Required states

- Open
- In progress
- Resolved
- Overdue (if a due date exists and has passed)

## Behaviour

- Status changes are real, auditable state (matching CMP-065's resolve/reopen auditability rule), never a purely local UI toggle.
- Overdue is computed live against a real due date and the current time, never a stale precomputed flag.

## Sizing

- Fits comfortably as a row in CMP-037 List or CMP-036 Data table depending on context.

## Keyboard and accessibility

- Whole card/row is a single Tab stop opening its detail; status/assignee/priority controls within an expanded detail view are separate subsequent stops.

## Acceptance criteria

- [ ] Status changes are real auditable state, not a local-only visual toggle.
- [ ] Overdue is computed live against the real current time and due date.

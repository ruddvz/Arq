# CMP-062: Export options

## Purpose

Select format, scope and validation.

## Anatomy

- Format selector
- Scope selector (whole project / current view / selection)
- Validation summary before export (delegates to CMP-032)
- Confirm action

## Required states

- Default
- Validating
- Blocked (validation problems exist)
- Ready to export

## Behaviour

- Export is blocked while real blocking validation problems exist, shown via the same CMP-032 pattern used elsewhere, never allowed to proceed to a broken output silently.
- Scope selection genuinely constrains what gets exported - a "current view" export never silently includes the whole project.

## Sizing

- Typically hosted in CMP-026 Dialog; sized to that dialog's content rules.

## Keyboard and accessibility

- Follows CMP-026 Dialog's and CMP-014 Select's keyboard contracts for its respective parts.

## Acceptance criteria

- [ ] Export is genuinely blocked (not just visually discouraged) while blocking validation problems exist.
- [ ] Selected scope accurately constrains the real exported content.

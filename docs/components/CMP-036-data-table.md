# CMP-036: Data table

## Purpose

Display sortable structured rows.

## Anatomy

- Column headers (sortable)
- Rows of structured data
- Optional row selection checkboxes
- Optional pagination/virtualisation

## Required states

- Default
- Sorted (ascending/descending per column)
- Row hover
- Row selected
- Empty (delegates to CMP-035)
- Loading (delegates to CMP-034/033)

## Behaviour

- Sorting is stable (equal keys keep their relative order) and reflected in the header via a visible + programmatic indicator, never colour alone.
- Large datasets are virtualised so scroll performance does not degrade with row count.

## Sizing

- Columns are resizable with a documented minimum width per column that keeps its header label legible.

## Keyboard and accessibility

- Arrow keys move a roving cell/row focus in a grid pattern (Up/Down/Left/Right); Home/End jump to the first/last cell in a row; Ctrl+Home/End jump to the first/last cell in the table.
- Space toggles row selection where selection is supported; Enter activates a row's primary action if one exists.

## Acceptance criteria

- [ ] Sort state is programmatically exposed (`aria-sort`), not colour-only.
- [ ] Full grid keyboard navigation works without a pointer, matching `role="grid"` conventions.
- [ ] Virtualised scrolling never drops or duplicates a row.

# CMP-008: Model tree

## Purpose

Navigate levels, views, sheets, imports and elements.

## Anatomy

- Search/filter field (delegates to CMP-013)
- Hierarchical tree of levels/views/sheets/imports/elements (rows are CMP-038 Tree item)
- Empty state for a project with nothing yet

## Required states

- Default
- Filtered (matches highlighted, non-matches collapsed)
- Empty (no project content yet)
- Node selected/multi-selected
- Node loading (large import still staging)

## Behaviour

- Selecting a node in the tree selects the same object on the canvas and in the inspector - one selection model shared across all three surfaces.
- Filtering never deletes or hides data, only visually collapses non-matching branches; clearing the filter restores the prior expand/collapse state exactly.
- A node still being staged from an in-progress import shows a loading affordance rather than appearing complete or missing.

## Sizing

- Resizable panel with a minimum width that keeps the deepest realistic nesting level legible without horizontal scroll for common projects.

## Keyboard and accessibility

- Arrow Up/Down moves focus between visible rows; Right expands a collapsed node, Left collapses/moves to parent.
- Type-ahead jumps focus to the next row starting with the typed character(s).
- Enter/Space selects; Shift+Arrow extends a contiguous multi-selection.

## Acceptance criteria

- [ ] Selection stays synchronised across tree, canvas, and inspector in both directions.
- [ ] Filter state is fully reversible without losing prior expand/collapse state.
- [ ] Full keyboard tree navigation (arrows, type-ahead, multi-select) works without a pointer.

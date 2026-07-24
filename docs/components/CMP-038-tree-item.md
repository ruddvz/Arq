# CMP-038: Tree item

## Purpose

Represent hierarchical content.

## Anatomy

- Expand/collapse disclosure triangle (if it has children)
- Icon indicating object type
- Label
- Optional trailing status/count

## Required states

- Collapsed (has children)
- Expanded
- Leaf (no children, no disclosure control)
- Selected/multi-selected
- Focus visible

## Behaviour

- Belongs to and is rendered by CMP-008 Model tree - it has no standalone existence outside a tree.
- Expand/collapse state persists across a session per node, rather than resetting whenever the tree is filtered or re-rendered.

## Sizing

- Indentation per depth level follows a fixed token so deep hierarchies stay legible without a horizontal scroll for realistic project depths.

## Keyboard and accessibility

- Delegates its Left/Right/Up/Down/type-ahead behaviour entirely to CMP-008's tree-level keyboard contract - it has no independent keyboard model of its own.

## Acceptance criteria

- [ ] Expand/collapse state persists correctly across filter/re-render within a session.
- [ ] Leaf nodes never render a disclosure control that does nothing.

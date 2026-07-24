# CMP-052: Selection outline

## Purpose

Show primary and secondary selection.

## Anatomy

- Outline/highlight rendered around selected geometry, distinguishing primary from secondary selection

## Required states

- Unselected (not rendered)
- Primary selection
- Secondary/additional selection (multi-select)

## Behaviour

- Primary and secondary selection are visually distinct (not just "everything selected looks the same"), since the primary selection is what property edits in CMP-009 Inspector target when values differ across a multi-selection.
- Never relies on colour alone - a distinct stroke pattern/weight also differs between primary and secondary.

## Sizing

- Stroke weight is legible at every supported zoom level, including scaling appropriately rather than becoming a solid blob when zoomed far out.

## Keyboard and accessibility

- Not itself interactive - purely a rendering consequence of the real selection state, which is set via canvas/tree/keyboard selection actions elsewhere.

## Acceptance criteria

- [ ] Primary vs secondary selection is distinguishable without relying on colour alone.
- [ ] Remains legible (not a solid blob, not invisible) across the supported zoom range.

# CMP-037: List

## Purpose

Display ordered or filtered items.

## Anatomy

- Ordered or filtered set of items
- Optional per-item leading/trailing content

## Required states

- Default
- Item hover
- Item selected
- Filtered (subset visible)
- Empty (delegates to CMP-035)

## Behaviour

- Simpler than CMP-036 Data table: single-column items with no per-column sort/resize - used when structure is genuinely one-dimensional.
- Filtering preserves the underlying item order rather than re-sorting by relevance unless the list explicitly documents relevance-ranked filtering.

## Sizing

- Item height is consistent across the list unless an item genuinely carries more content (e.g. a two-line item), in which case that height difference is intentional and documented, not accidental.

## Keyboard and accessibility

- Arrow Up/Down moves a roving item focus; Enter/Space activates the focused item.

## Acceptance criteria

- [ ] Roving focus and Enter/Space activation work without a pointer.
- [ ] Filtering never reorders items unless explicitly documented as relevance-ranked.

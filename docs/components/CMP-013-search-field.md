# CMP-013: Search field

## Purpose

Search pages, objects or commands.

## Anatomy

- Search icon
- Input
- Clear button (appears once non-empty)
- Optional live result count

## Required states

- Empty
- Typing (debounced)
- Has results
- No results found
- Disabled with reason

## Behaviour

- Debounces query execution so every keystroke does not trigger a full search pass.
- "No results" is an explicit, distinct empty state (CMP-035), never an indistinguishable blank list.
- Clear button both empties the field and returns focus to the input, ready for a new query.

## Sizing

- Matches CMP-011's field height; grows to fill its container width up to a sensible maximum.

## Keyboard and accessibility

- Escape clears the query if non-empty, or blurs the field if already empty.
- Down Arrow from the field moves focus into the first result, where the results list owns further navigation.

## Acceptance criteria

- [ ] Query execution is debounced, not fired on every keystroke.
- [ ] Empty/no-results/has-results are each a distinct, correctly-announced state.
- [ ] Escape's two-stage behaviour (clear, then blur) works exactly as specified.

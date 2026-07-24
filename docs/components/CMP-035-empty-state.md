# CMP-035: Empty state

## Purpose

Explain absence and next action.

## Anatomy

- Icon or illustration
- Explanatory text
- Optional primary next action

## Required states

- Visible (no content yet)
- Visible (no results after a filter/search)

## Behaviour

- Explains the specific reason for absence (never had content, vs. filtered to zero results) rather than one generic "Nothing here" message for both cases.
- Where a clear next action exists (e.g. "New project"), it is offered directly rather than left for the user to discover elsewhere.

## Sizing

- Centred within its container; scales down gracefully on narrow viewports rather than clipping.

## Keyboard and accessibility

- Its optional action is a normal focusable button reachable by Tab.

## Acceptance criteria

- [ ] Distinguishes "never had content" from "filtered to zero results" with different, accurate text.
- [ ] Offers a real next action where one genuinely exists.

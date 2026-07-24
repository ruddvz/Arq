# CMP-084: Coachmark

## Purpose

Teach a contextual onboarding step.

## Anatomy

- Pointer/highlight toward a specific UI element
- Short explanatory text
- Dismiss/next action
- Optional step counter (e.g. "2 of 4")

## Required states

- Visible (current step)
- Dismissed

## Behaviour

- Never blocks the underlying UI from being used while visible - a coachmark explains, it does not gate.
- Dismissing it (at any step) permanently dismisses the whole sequence rather than restarting it unexpectedly on next launch, unless the user explicitly reopens onboarding.

## Sizing

- Positioned relative to the element it explains, repositioning/flipping to stay fully within the viewport, following the same rule as CMP-024 Popover.

## Keyboard and accessibility

- Escape dismisses the whole sequence; a documented key (e.g. Enter or a "Next" button) advances to the next step; the underlying UI beneath it remains fully keyboard-operable throughout.

## Acceptance criteria

- [ ] Never blocks interaction with the real UI element it is pointing at.
- [ ] Dismissal is permanent for the session rather than silently reappearing.

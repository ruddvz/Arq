# CMP-075: AI request field

## Purpose

Enter a bounded natural-language request.

## Anatomy

- Bounded text input
- Character/length indicator
- Submit action
- Optional context chip showing what the request will apply to (e.g. current selection)

## Required states

- Empty
- Typing
- Submitted (processing)
- Disabled with reason

## Behaviour

- Bounded by a real, stated length limit rather than silently truncating at submission.
- Shows what context (selection/scope) the request applies to before submission, so the user is never surprised by what the AI acted on.

## Sizing

- Multi-line, growing up to a maximum height with internal scrolling beyond that, matching CMP-011's general text-input conventions.

## Keyboard and accessibility

- Enter submits (Shift+Enter inserts a newline); Escape clears an unsubmitted draft.

## Acceptance criteria

- [ ] Length limit is stated and enforced before submission, not a silent truncation.
- [ ] Applied context/scope is always shown before the request is sent.

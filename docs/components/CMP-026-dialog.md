# CMP-026: Dialog

## Purpose

Require focused confirmation or input.

## Anatomy

- Overlay/scrim
- Title
- Body content
- Primary and secondary actions
- Optional close control

## Required states

- Closed
- Open
- Open with a validation error blocking its primary action
- Busy (primary action in progress)

## Behaviour

- Modal: traps focus within itself while open and blocks interaction with the rest of the page via the scrim.
- Closing via any path (action button, Escape, scrim click, close control) returns focus to the exact element that opened it - the precise defect (BUG-RISK-140) already found and fixed in the static prototype (issue ARQ-211/#211).
- A destructive primary action (delete, discard) is visually distinct from a neutral one and never the pre-focused default unless the destructive action is genuinely what most users want (e.g. confirming a delete they already explicitly requested).

## Sizing

- Sized to its content up to a maximum width/height per breakpoint; scrolls its body internally rather than exceeding the viewport.

## Keyboard and accessibility

- Focus moves to the dialog (its title or first focusable element) on open, and is trapped within it via Tab/Shift+Tab.
- Escape closes it exactly like a cancel action, unless the dialog explicitly documents itself as non-dismissable (e.g. mid-destructive-operation with no safe cancel point).

## Acceptance criteria

- [ ] Focus returns to the exact trigger element after every close path (button, Escape, scrim click).
- [ ] Focus is trapped within the dialog while open; Tab never escapes to the background page.
- [ ] `role="dialog"`/`aria-modal="true"` and a real accessible name (title) are present.

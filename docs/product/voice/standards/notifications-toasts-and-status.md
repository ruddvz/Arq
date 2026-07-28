# Notifications, toasts, banners and status copy

Transient copy is still product state. It must not become a second vocabulary.

## Choose the surface by consequence

Use inline state when the information belongs to an object, field, tool or panel.
Use the status bar for persistent workspace state such as units, selection, local save and sync.
Use a banner when the condition changes what the user can safely do across the current surface.
Use a toast only for a brief, non-blocking acknowledgement that does not need to remain visible.
Use a dialog when an explicit decision is required before continuing.

Do not use a toast for data-loss risk, migration, recovery, permission loss, unresolved import fidelity or sync conflict.

## Toast grammar

Prefer exact object + result.

Good:

- `PDF exported`
- `View duplicated`
- `3 comments marked resolved`
- `Project renamed`

Avoid:

- `Success!`
- `Done`
- `All set`
- `Saved` when the system means `Saved locally`

## Progress

Name the operation and, only when measured, its progress.

- `Checking project file…`
- `Converting DXF… 42%`
- `Exporting 3 sheets…`

Never invent a percentage or time remaining.

## Partial completion

Partial is its own state, not success with a footnote.

Structure:

1. what completed;
2. what did not;
3. what output exists;
4. whether retrying can duplicate work;
5. next action.

## Repeated events

Coalesce noisy repeated notifications. A drafting tool should not emit a toast for every ordinary successful commit when the changed geometry already provides immediate feedback.

## Accessibility

Live regions must not repeat visible labels with decorative words. Announce the meaningful state change once. Do not rely on icon, colour, vibration or sound alone.

# CMP-007: Status bar

## Purpose

Show units, snap, selection, save, sync and model health.

## Anatomy

- Unit system indicator (metric/imperial)
- Active snap type (delegates to CMP-053 Snap glyph)
- Selection summary (count and type)
- Save/sync status (delegates to CMP-072 Sync state)
- Model health summary (delegates to CMP-070)

## Required states

- Default
- Selection empty vs populated
- Snap active vs inactive
- Sync: saved/saving/offline/conflict
- Model health: healthy/warnings/errors

## Behaviour

- Every segment is read-only status except the unit toggle, which is a real control.
- Model health segment is clickable and opens CMP-070/CMP-071 detail, but only when there is something to show - not a dead click target when healthy.
- Never blocks or delays canvas interaction; it only reflects state, it does not gate it.

## Sizing

- Fixed single-row height across the whole application; segments truncate individually under width pressure, never the whole bar.

## Keyboard and accessibility

- Each interactive segment (unit toggle, model health) is an independent Tab stop with its own accessible name.
- Status-only segments (snap, selection, sync) are exposed via `aria-live="polite"` region updates, not as focusable elements.

## Acceptance criteria

- [ ] Status-only segments are announced via `aria-live`, not focus-stealing.
- [ ] Model health segment truthfully reflects zero, warning, and error counts with no lag from the actual model state.
- [ ] Unit toggle change is reflected immediately across every open numeric field.

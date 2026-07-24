# CMP-033: Progress indicator

## Purpose

Show determinate or indeterminate work.

## Anatomy

- Track/spinner
- Optional percentage/label
- Optional cancel action

## Required states

- Determinate (known percentage)
- Indeterminate (unknown duration)
- Complete
- Failed

## Behaviour

- Uses determinate form whenever real progress can be measured (e.g. bytes processed of a known total); falls back to indeterminate only when genuinely unknown.
- A cancellable operation exposes its cancel action directly on the indicator, not buried elsewhere.

## Sizing

- Compact inline form for small operations; a full-width bar form for page-level/import-export operations (CMP-082 Job progress builds on this).

## Keyboard and accessibility

- Its cancel action, when present, is a normal focusable button reachable by Tab.

## Acceptance criteria

- [ ] Determinate form is used whenever real progress is measurable, not defaulted to indeterminate out of convenience.
- [ ] Completion and failure are each announced via `aria-live`, not left to visual inference alone.

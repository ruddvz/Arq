# CMP-070: Model health indicator

## Purpose

Summarise warnings and errors.

## Anatomy

- Compact summary (counts of warnings/errors)
- Entry point into CMP-071 Recovery panel or a detailed issue list

## Required states

- Healthy (no issues)
- Warnings present
- Errors present

## Behaviour

- Counts always reflect the real, live current model state - never a stale count from before the user's last edit.
- Errors and warnings are visually and programmatically distinct severities, not merged into one generic "issues" count.

## Sizing

- Compact, typically hosted in CMP-007 Status bar.

## Keyboard and accessibility

- A single Tab stop that opens the detailed issue list/panel on activation.

## Acceptance criteria

- [ ] Counts are always live-accurate, never stale after an edit.
- [ ] Errors and warnings are distinguishable, not merged into one count.

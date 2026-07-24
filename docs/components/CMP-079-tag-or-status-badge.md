# CMP-079: Tag or status badge

## Purpose

Show compact labelled status.

## Anatomy

- Compact label with optional leading icon, indicating a status or tag

## Required states

- Default (per status/tag value)

## Behaviour

- Never relies on colour alone to distinguish different statuses - text (and icon, where used) always differs too, matching CMP-068's same rule for the specific revision-badge case.

## Sizing

- Compact, fixed height; text truncates only if genuinely necessary, with the full value available via tooltip.

## Keyboard and accessibility

- Not independently focusable; purely a status label rendered inline.

## Acceptance criteria

- [ ] Distinguishable without relying on colour alone.
- [ ] Full value remains available (via tooltip) if truncated.

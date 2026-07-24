# CMP-073: Offline indicator

## Purpose

Show network-independent status.

## Anatomy

- Compact icon/text indicating the app is currently offline

## Required states

- Online (hidden or neutral)
- Offline

## Behaviour

- Reflects real, live network-independent operation status (matches this repo's local-first design) - the application keeps working offline, and this indicator says so honestly rather than implying broken state.

## Sizing

- Compact, typically hosted in CMP-007 Status bar alongside CMP-072.

## Keyboard and accessibility

- Announced via `aria-live="polite"` on state change; not independently focusable.

## Acceptance criteria

- [ ] Never implies the application is broken while offline - states the real, still-functional offline status.
- [ ] Updates immediately on a real connectivity change, not on a delayed poll.

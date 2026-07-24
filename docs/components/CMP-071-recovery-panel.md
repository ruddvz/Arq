# CMP-071: Recovery panel

## Purpose

Explain recovered and incomplete work.

## Anatomy

- List of recovered content
- List of content that could not be recovered, with reason
- Acknowledge/continue action

## Required states

- Visible after a recovery event
- Acknowledged/dismissed

## Behaviour

- States plainly and specifically what was recovered and what was not, with a real reason for the latter - never a vague "some content may be missing."
- Delegates to the real recovery-report data (matches `packages/arqfs`'s `arqfs-recovery-report.ts`/`arqfs-safe-mode.ts` structured plan, not a UI-invented summary).

## Sizing

- Typically hosted in CMP-026 Dialog on first open after a recovery event; scrolls internally for a long list of affected content.

## Keyboard and accessibility

- Follows CMP-026 Dialog's keyboard contract; the acknowledge action is its primary/default focused action on open.

## Acceptance criteria

- [ ] Every listed unrecovered item states a real, specific reason, never a generic disclaimer.
- [ ] Content shown is sourced from the real recovery report structure, not invented in the UI layer.

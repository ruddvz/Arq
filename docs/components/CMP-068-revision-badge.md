# CMP-068: Revision badge

## Purpose

Show draft, review or issued state.

## Anatomy

- Compact label indicating draft/review/issued state

## Required states

- Draft
- In review
- Issued

## Behaviour

- Reflects the real current revision state from the model, never a locally-cached or optimistic guess that could disagree with the source of truth.
- Never relies on colour alone - each state has distinct text, matching this component's whole reason for existing.

## Sizing

- Compact, fixed height matching other inline badges (CMP-079).

## Keyboard and accessibility

- Not independently focusable; purely a status label rendered inline wherever a sheet/revision is shown.

## Acceptance criteria

- [ ] Always reflects the real current state, never a stale cached guess.
- [ ] Distinct text per state, not colour-only.

# CMP-040: Breadcrumb

## Purpose

Show hierarchical location.

## Anatomy

- Ordered sequence of ancestor labels
- Separators
- Current (non-clickable) final segment

## Required states

- Default
- Truncated (collapses middle segments on narrow width)

## Behaviour

- Every segment except the final (current) one is a real navigation link, not decorative text.
- Truncation collapses middle segments behind an overflow affordance rather than dropping them entirely, so the full path remains reachable.

## Sizing

- Single line; truncates via overflow rather than wrapping to a second line.

## Keyboard and accessibility

- Each ancestor segment is an independent Tab stop and real link/button; the current segment is not focusable since it performs no action.

## Acceptance criteria

- [ ] Every non-current segment genuinely navigates.
- [ ] Truncated segments remain reachable via the overflow affordance, never silently lost.

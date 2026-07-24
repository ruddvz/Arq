# CMP-078: Filter bar

## Purpose

Filter lists, warnings or issues.

## Anatomy

- One or more filter controls (delegates to CMP-014/016/017 depending on filter type)
- Active-filter summary/chips
- "Clear all" action

## Required states

- No filters active
- One or more filters active
- Filter combination yields zero results (delegates to CMP-035)

## Behaviour

- Active filters are always visible as a summary/chips, never hidden state the user has to remember or re-open a panel to check.
- "Clear all" restores exactly the unfiltered state, never a partial or stale reset.

## Sizing

- Wraps to multiple rows on narrow widths rather than clipping active-filter chips.

## Keyboard and accessibility

- Each filter control and each removable chip is an independent Tab stop; "Clear all" is a normal focusable button.

## Acceptance criteria

- [ ] Active filters are always visibly summarised, never hidden state.
- [ ] "Clear all" always restores the exact true unfiltered state.

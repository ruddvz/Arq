# CMP-021: Tabs

## Purpose

Navigate peer sections.

## Anatomy

- Tab list
- Individual tab triggers
- Associated tab panel

## Required states

- Default
- Focus visible (on the focused tab)
- Selected tab
- Disabled tab with reason

## Behaviour

- Switching tabs preserves each unselected panel's scroll position and any in-progress uncommitted edit rather than discarding it.
- A disabled tab (e.g. a Document tab before any sheet exists) states why rather than simply being unreachable with no explanation.

## Sizing

- Tab list height is fixed; long tab labels truncate with an accessible full label available via tooltip.

## Keyboard and accessibility

- Arrow Left/Right moves focus and selection between tabs (roving tabindex, single Tab stop for the tab list itself).
- Tab (the key) moves from the tab list into the currently-selected panel's content.

## Acceptance criteria

- [ ] Switching tabs never discards an unselected panel's in-progress state.
- [ ] Tab list is a single Tab stop; arrow keys move both focus and selection together.
- [ ] `role="tablist"`/`role="tab"`/`role="tabpanel"` and `aria-selected` are used correctly.

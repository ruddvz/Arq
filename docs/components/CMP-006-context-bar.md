# CMP-006: Context bar

## Purpose

Expose immediate controls for the active tool or selection.

## Anatomy

- Context-dependent control group
- Optional selection summary (count/type)
- Optional confirm/cancel for multi-step tool settings

## Required states

- Empty (no tool/selection - hidden or shows a hint)
- Populated for active tool
- Populated for active selection
- Disabled sub-controls where a setting does not apply

## Behaviour

- Content is entirely driven by the active tool or selection - it has no state of its own to persist across a tool change.
- Never shows controls for a setting that cannot apply to the current selection (e.g. wall thickness when nothing is selected).
- Changes commit immediately per control (this is a live settings surface, not a form with a separate save step).

## Sizing

- Height adapts to its densest realistic content but does not grow unbounded - overflow controls collapse into a menu.

## Keyboard and accessibility

- Tab order flows left to right through whatever controls are currently shown.
- Escape returns focus to the canvas/model without discarding already-committed changes.

## Acceptance criteria

- [ ] Empty state never shows disabled ghost controls for a tool that is not active.
- [ ] Every visible control is genuinely applicable to the current tool/selection.
- [ ] Tab order stays predictable as controls change between tools.

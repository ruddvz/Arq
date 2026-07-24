# CMP-018: Switch

## Purpose

Toggle an immediate setting.

## Anatomy

- Switch track and thumb
- Label
- Optional immediate-effect notice for a setting with side effects

## Required states

- Off
- On
- Focus visible
- Disabled with reason
- Transitioning (mid-animation, non-interactive)

## Behaviour

- Change takes effect immediately on toggle - a switch never requires a separate "apply"/"save" step, unlike a form field.
- If the setting has a consequence the user should know before confirming, a switch is the wrong component - use a checkbox with an explicit confirm action instead.

## Sizing

- Track/thumb sizing follows the design tokens; full label+switch hit target is at least 44pt tall on iPad.

## Keyboard and accessibility

- Space toggles when focused; Enter is not overloaded onto a switch to avoid double-meaning with dialog "default action" semantics.

## Acceptance criteria

- [ ] Toggling has no separate save step - the underlying setting changes immediately.
- [ ] `role="switch"` and `aria-checked` are used, not a checkbox role.
- [ ] Disabled reason is exposed via `aria-describedby`.

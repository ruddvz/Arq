# CMP-002: Icon button

## Purpose

Trigger a compact action with an accessible name.

## Anatomy

- Container
- Icon glyph
- Accessible name via `aria-label`
- Optional badge (unread/count)

## Required states

- Default
- Hover
- Focus visible
- Active/pressed
- Disabled with reason
- Selected (toggle-style icon buttons)

## Behaviour

- Never ships without an accessible name - the icon alone is not a label.
- A toggle-style icon button (e.g. mute/unmute) exposes `aria-pressed`, not just a visual colour change.
- Adjacent icon buttons keep at least 8px of visual separation so adjacent 44pt touch targets do not overlap.

## Sizing

- Hit target is at least 44x44pt on iPad even when the glyph itself is 20-24px.
- Icon-only - no visible label text ever appears, by definition of this component.

## Keyboard and accessibility

- Space and Enter activate; if toggle-style, activation flips `aria-pressed` and is announced.
- A tooltip (CMP-025) shows the accessible name on hover/focus for sighted pointer/keyboard users.

## Acceptance criteria

- [ ] Every instance has a real accessible name, verified programmatically, not just visually apparent.
- [ ] Toggle-style instances expose `aria-pressed` and are announced on change.
- [ ] Touch target measures at least 44x44pt regardless of glyph size.

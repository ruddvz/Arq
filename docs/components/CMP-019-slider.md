# CMP-019: Slider

## Purpose

Adjust a bounded continuous value.

## Anatomy

- Track
- Thumb
- Current value readout
- Optional min/max labels
- Optional step ticks

## Required states

- Default
- Focus visible
- Dragging (thumb active)
- Disabled with reason

## Behaviour

- Dragging the thumb previews the value live; the underlying setting commits continuously or on release, per the specific control's own documented choice - never silently only on blur with no visual feedback while dragging.
- Always shows the current numeric value as text, never relying on thumb position alone for a value that matters precisely.

## Sizing

- Track is at least 44pt long in its scrolling/interactive axis on iPad; thumb hit target is at least 44x44pt even if the visual thumb is smaller.

## Keyboard and accessibility

- Arrow Left/Right (or Up/Down if vertical) adjusts by one step; Page Up/Down adjusts by a larger step; Home/End jump to min/max.

## Acceptance criteria

- [ ] Current value is always shown as readable text, not thumb-position-only.
- [ ] Full keyboard operation (arrows, page, home/end) works without a pointer.
- [ ] Thumb hit target meets 44pt even when the visual thumb is smaller.

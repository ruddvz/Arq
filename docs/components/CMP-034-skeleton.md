# CMP-034: Skeleton

## Purpose

Reserve loading layout.

## Anatomy

- Shape(s) approximating the real content's eventual layout

## Required states

- Visible (loading)
- Replaced by real content

## Behaviour

- Reserves the exact layout space the real content will occupy, so its arrival never causes a layout shift.
- Never shown for longer than a brief, genuinely-loading window - a slow operation should switch to CMP-033 Progress indicator instead once it is clear the wait is non-trivial.

## Sizing

- Matches the real content's eventual dimensions exactly, not an approximate placeholder size.

## Keyboard and accessibility

- Not focusable; purely visual, and marked `aria-hidden` so screen readers do not announce a shape with no real content yet.

## Acceptance criteria

- [ ] Causes zero layout shift when replaced by real content.
- [ ] Never used to disguise a genuinely long-running operation that should show real progress instead.

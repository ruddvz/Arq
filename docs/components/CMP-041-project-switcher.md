# CMP-041: Project switcher

## Purpose

Change active project.

## Anatomy

- Container
- Primary content
- Optional leading visual
- Optional supporting content
- Optional status or validation
- Accessible label or name

## Required states

- Default
- Hover where pointer exists
- Focus visible
- Active or pressed
- Disabled with reason where useful
- Loading where applicable
- Invalid where applicable
- Selected where applicable

## Behaviour

- Does not commit destructive work without explicit intent.
- Does not rely on colour alone.
- Preserves focus when content updates.
- Uses the same command and permission rules as the underlying action.
- Explains unavailable actions.
- Supports reduced motion.

## Sizing

- Desktop density follows design tokens.
- iPad target is at least 44 points.
- The visual glyph may be smaller than its hit target.
- Truncated text exposes the full value safely.

## Keyboard and accessibility

- Native keyboard semantics where possible
- Space and Enter follow platform expectations
- Escape closes temporary content without undoing committed work
- Programmatic role, name, state and value
- Error association and focus management
- Screen-reader announcement for asynchronous changes

## Acceptance criteria

- [ ] All required states are implemented.
- [ ] Keyboard and touch behaviour are tested.
- [ ] Contrast and focus pass.
- [ ] Disabled reason is available.
- [ ] No project content is sent through analytics.
- [ ] Visual regression covers protected states.

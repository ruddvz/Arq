# CMP-051: Selection handle

## Purpose

Manipulate selected geometry.

## Anatomy

- Draggable grip rendered at a manipulable geometry point (endpoint, midpoint, corner)

## Required states

- Default
- Hover
- Dragging
- Snapped (delegates to CMP-053 Snap glyph while dragging)

## Behaviour

- Dragging respects the same active snap settings as any other drawing operation - a handle drag is not a separate, unsnapped code path.
- A drag that would produce invalid/degenerate geometry (e.g. collapsing a wall to zero length) is rejected at drop, reverting to the last valid position rather than committing broken geometry.

## Sizing

- Hit target is at least 44x44pt on iPad even though the visual grip is typically much smaller, matching every other interactive control's touch-target rule.

## Keyboard and accessibility

- A selected handle can be nudged by arrow keys at the current grid/snap increment, so precise adjustment is not pointer-only.

## Acceptance criteria

- [ ] A drag that would produce degenerate geometry is rejected, not silently committed.
- [ ] Keyboard nudging works as a genuine alternative to pointer dragging.
- [ ] Touch target meets 44pt regardless of visual grip size.

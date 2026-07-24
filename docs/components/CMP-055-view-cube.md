# CMP-055: View cube

## Purpose

Change 3D orientation.

## Anatomy

- 3D orientation cube/indicator with face/edge/corner hit regions

## Required states

- Default
- Hover (per face/edge/corner)
- Active drag (free rotate)

## Behaviour

- Clicking a face/edge/corner animates to that exact standard orientation; dragging free-rotates the 3D view continuously.
- 3D-view-only - hidden or disabled in plan/2D views where orientation has no meaning.

## Sizing

- Fixed small size in a corner of the 3D viewport, never obscuring model content beneath it.

## Keyboard and accessibility

- A documented set of shortcuts (e.g. numeric keys for standard views) provides the same standard-orientation jumps as clicking a face, so the view cube itself is not the only way to reach a given orientation.

## Acceptance criteria

- [ ] Every standard orientation reachable by click is also reachable by a documented keyboard shortcut.
- [ ] Correctly hidden/disabled outside 3D views.

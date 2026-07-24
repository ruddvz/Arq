# CMP-064: Comment pin

## Purpose

Anchor a comment to model or sheet.

## Anatomy

- Pin marker anchored to a model/sheet coordinate
- Author avatar (delegates to CMP-044)
- Resolved/unresolved indicator

## Required states

- Unresolved
- Resolved
- Hover (preview)
- Selected (opens CMP-065 Comment thread)

## Behaviour

- Stays anchored to its real model/sheet coordinate through pan/zoom, and through any geometry edit that moves the annotated object, rather than drifting to a stale screen position.
- Resolved pins remain visible (dimmed/distinct) rather than disappearing, so resolved discussion history stays discoverable.

## Sizing

- Hit target at least 44x44pt on iPad even though the visual pin marker is smaller.

## Keyboard and accessibility

- Reachable via CMP-008 Model tree's comment listing (not pointer-only), opening the same CMP-065 thread that clicking the pin would.

## Acceptance criteria

- [ ] Pin position never drifts from its real anchored coordinate through pan/zoom/geometry edits.
- [ ] Resolved pins remain visible and reachable, not deleted from view.

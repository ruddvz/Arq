# CMP-039: Card

## Purpose

Summarise a project or template.

## Anatomy

- Thumbnail/preview
- Title
- Metadata (e.g. last saved, sync status)
- Optional actions (delegates to CMP-022 Menu)

## Required states

- Default
- Hover
- Focus visible
- Selected (in a multi-select grid)
- Syncing/offline (delegates to CMP-072/CMP-073)

## Behaviour

- The whole card is a single activation target (opens the project/template) in addition to any secondary actions menu, so a click anywhere on the card except an explicit action opens it.
- Thumbnail reflects real current project content where available, falling back to a generic placeholder rather than a stale image.

## Sizing

- Fixed aspect ratio for the thumbnail region across a grid of cards so the grid stays visually aligned.

## Keyboard and accessibility

- The whole card is one Tab stop, activated by Enter; its secondary-actions menu (if present) is a separate, subsequent Tab stop.

## Acceptance criteria

- [ ] Card and its secondary-actions menu are each independently reachable and operable by keyboard.
- [ ] Thumbnail never shows stale content once real project content exists.

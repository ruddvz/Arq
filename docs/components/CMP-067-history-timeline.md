# CMP-067: History timeline

## Purpose

Show revisions and operations.

## Anatomy

- Chronological list of revisions and their constituent operations
- Author + timestamp per entry
- Optional diff/compare entry point (delegates to CMP-069)

## Required states

- Default
- Entry expanded (showing constituent operations)
- Loading more (older history, paginated)

## Behaviour

- Reflects the real, immutable operation log - it never allows silently editing or deleting a past entry, only appending new ones (matches this repo's own operations/collaboration package design).
- Loads incrementally (paginated) for a long project history rather than requiring the whole history to load before showing anything.

## Sizing

- Scrolls internally; loads more entries as the user scrolls near the end rather than all at once.

## Keyboard and accessibility

- Arrow Up/Down moves a roving entry focus; Enter expands/collapses an entry's constituent operations.

## Acceptance criteria

- [ ] Never allows editing or deleting a real past history entry - append-only, verified against the underlying operation log.
- [ ] Incremental loading never drops or duplicates an entry at the pagination boundary.

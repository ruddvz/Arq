# CMP-004: Top application bar

## Purpose

Show project identity and global actions.

## Anatomy

- Project/document title (editable inline)
- Save/sync status (delegates to CMP-072 Sync state)
- Global actions (share, undo/redo, command palette entry)
- Workspace/user menu entry point

## Required states

- Default
- Title in edit mode
- Sync status: saved/saving/offline/conflict
- Narrow-viewport collapsed (icons only)

## Behaviour

- Persists across every tool/mode change - never re-rendered or reflowed by a tool switch.
- Title edits commit on blur or Enter, and revert on Escape without saving a partial edit.
- On a narrow viewport, secondary actions collapse into an overflow menu rather than being hidden entirely.

## Sizing

- Fixed height across the whole application chrome; never resizes when content below it changes.
- Title truncates with an accessible full name available via tooltip/title attribute.

## Keyboard and accessibility

- Tab order moves left-to-right through title, then global actions, then workspace/user menu.
- A documented shortcut (matching CMP-047 Command palette) opens global search/commands directly from anywhere.

## Acceptance criteria

- [ ] Title edit commits and reverts correctly on blur/Enter/Escape.
- [ ] Sync status is always one of a known finite set, never blank or ambiguous.
- [ ] Narrow-viewport collapse preserves access to every action via overflow, none silently dropped.

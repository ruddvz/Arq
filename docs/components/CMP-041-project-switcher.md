# CMP-041: Project switcher

## Purpose

Change active project.

## Anatomy

- Trigger showing the current project name
- Popup list of recent/available projects
- Search/filter within the popup for large lists

## Required states

- Closed
- Open
- Filtering (many projects)
- Loading (project list still fetching)

## Behaviour

- Switching projects preserves the current one's in-progress uncommitted state (auto-saves or explicitly prompts) rather than discarding it silently.

## Sizing

- Popup grows to a maximum height with internal scrolling for large project lists rather than exceeding the viewport.

## Keyboard and accessibility

- Follows CMP-014 Select's keyboard contract (open, arrow-navigate, type-ahead filter, commit, escape).

## Acceptance criteria

- [ ] Never silently discards unsaved state when switching - either auto-saves first or explicitly prompts.
- [ ] Full keyboard operation matches CMP-014's contract.

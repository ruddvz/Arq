# CMP-032: Validation summary

## Purpose

List blocking problems.

## Anatomy

- Heading (count of problems)
- List of individual problems, each linking to its source field/object

## Required states

- Hidden (no blocking problems)
- Visible with N problems

## Behaviour

- Aggregates every current blocking problem across the whole current view/form, each as a link that moves focus to and highlights its source field/object.
- Distinct from CMP-031: this is the "everything wrong in one place" view used before a blocking action (e.g. export, publish); CMP-031 is the per-field detail shown at the source.

## Sizing

- Height scrolls internally beyond a reasonable maximum rather than pushing the blocking action off-screen.

## Keyboard and accessibility

- Each listed problem is a real link/button; activating it moves focus to the corresponding field and announces the same message CMP-031 shows there.

## Acceptance criteria

- [ ] Every listed problem correctly navigates focus to its real source field/object.
- [ ] Count shown always matches the real number of currently-blocking problems, with no stale entries after a problem is fixed.

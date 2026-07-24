# CMP-081: File row

## Purpose

Show file name, status, size and actions.

## Anatomy

- File name
- Status (delegates to CMP-072/CMP-070 style indicators as applicable)
- Size
- Row actions (delegates to CMP-022 Menu)

## Required states

- Default
- Hover
- Processing (import/export in progress, delegates to CMP-082)
- Error

## Behaviour

- Shows real current file size and status, never a stale value from when the row was first rendered.
- Row actions available always reflect what is genuinely possible for that file's current status (e.g. no "open" action for a file still processing).

## Sizing

- Fits as a row within CMP-036 Data table or CMP-037 List depending on context.

## Keyboard and accessibility

- Row is a Tab stop for its primary action; the row actions menu is a separate, subsequent Tab stop.

## Acceptance criteria

- [ ] Size/status shown is always live-accurate, not stale.
- [ ] Available row actions always match what is genuinely valid for the file's current real status.

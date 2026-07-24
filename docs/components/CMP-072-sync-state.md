# CMP-072: Sync state

## Purpose

Distinguish local save from cloud sync.

## Anatomy

- Compact status text/icon distinguishing local-save from cloud-sync

## Required states

- Saved locally, not yet synced
- Syncing
- Synced
- Sync error

## Behaviour

- Explicitly distinguishes "safe on this device" from "safe in the cloud" - these are never merged into one ambiguous "saved" state, since the difference is materially important if the device is lost.
- Sync error state names the real problem where known (e.g. offline vs a real conflict) rather than one generic failure icon.

## Sizing

- Compact, typically hosted in CMP-004 Top application bar and/or CMP-007 Status bar.

## Keyboard and accessibility

- Announced via `aria-live="polite"` on state change; not independently focusable unless clicking it opens more detail, in which case it is a normal Tab stop.

## Acceptance criteria

- [ ] Local-save and cloud-sync are always distinguishable, never merged.
- [ ] Sync error names the real specific problem where the underlying system knows it.

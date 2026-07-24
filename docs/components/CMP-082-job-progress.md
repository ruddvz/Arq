# CMP-082: Job progress

## Purpose

Show import or export stage and cancellation.

## Anatomy

- Stage label (e.g. detecting/converting/validating/staging)
- Progress indicator (delegates to CMP-033)
- Cancel action

## Required states

- Queued
- In progress (per real pipeline stage)
- Cancelling
- Cancelled
- Complete
- Failed

## Behaviour

- Stage label always reflects the real current stage of the actual import/export pipeline (matches this repo's real `ImportWorkerRequest`/`ImportWorkerResponse` stages), never a generic "Working..." with no real detail.
- Cancellation is honoured promptly and never results in a stale "converted"/"failed" result appearing after the user was already told it was cancelled - this exact race (FP-019) was found and fixed in the real worker handler this component reflects.

## Sizing

- Compact row form for a file list context; a larger standalone form for a single big operation.

## Keyboard and accessibility

- Cancel is a normal, always-reachable focusable button while an operation is in progress.

## Acceptance criteria

- [ ] Stage label always matches the real current pipeline stage, not a generic placeholder.
- [ ] Never shows a converted/failed result for an operation the user was already told was cancelled.

# Save, publication, and recovery UX

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Save must communicate the difference between working recovery, accepted revision, and portable publication without exposing database internals unnecessarily.

## Normative requirements

- The UI MUST show publication phases: preparing snapshot, creating candidate, validating structure, validating project, reopening, and promoting.
- Progress MUST be phase-based. It MUST not display invented percentages when work cannot be measured.
- On failure, the UI MUST state that the prior source remains unchanged when evidence supports that statement.
- Save As MUST never silently replace the source. Overwrite requires an explicit destination decision and successful candidate validation.
- Recovery UI MUST show project identity, base revision, last accepted operation, recovery age, source association, and conflicts before applying recovery.
- Autosave or journal recovery MUST create a reviewed recovery candidate and new revision rather than rewriting history invisibly.

## Required invariants

- Browser tab closes during publication.
- Storage quota exhausted.
- Destination permission revoked.
- Candidate valid but promotion fails.
- Two tabs save same destination.
- Recovery journal belongs to different branch.

## Known failure modes

- Previous valid publication remains available after failure.
- Recovered work is attributable and undoable.
- The user can inspect the exact failure phase.

## Required evidence

- Crash-injection UX tests.
- Quota and permission simulations.
- Destination collision tests.
- Screen-reader announcement of phase and failure.

## Implementation guidance

- Keep technical logs behind Details.
- Offer retry only when operation is safe and idempotent.
- Offer Save a copy when overwriting cannot be proved safe.

## Open decisions

- Whether background autosave creates portable snapshots or only local journals.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

# Zeus Output Standard

The executor prompt and final result must be specific to Arq's actual workflow,
repository and decision state.

## Reject generic language

Bad: “Improve UX, optimize performance, assign agents and check CI.”

Good: “For the wall command, preserve the first point when numeric validation fails,
block zero-length commit, keep Escape atomic, add touch/Pencil parity, update the
existing editor-shell tests, capture 390px and tablet visual fixtures, open a draft PR,
triage every required workflow at the current head, merge only with explicit authority,
and verify the deployed SHA plus create/open `.arq` smoke path.”

## Required qualities

- current and desired state separated;
- exact scope/non-goals;
- existing systems reused;
- accountable role/reviewers;
- dependency graph;
- affected files/contracts or discovery instructions;
- complete error/recovery states;
- binary acceptance mapped to evidence;
- local, CI and production stop point;
- actual limitations and authority.

## Status vocabulary

Green, Partial, Blocked, Failed, Rolled back. “Perfect” is never a status.

# Product, UI, and UX Remediation Plan

This plan distinguishes observed audit facts from recommendations. It does not
pretend that a source file alone proves a user experience is complete.

## P0: protect user work and truthful state

| Recommendation                                                                                                                  | Why it matters                                                                                                                | Acceptance evidence                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Separate "Recovered locally", "Saved to project file", "Saving", "Could not save", and "Offline" in the workspace status model. | Current journal recovery and native project-file persistence are different systems. A shared "Saved" label can mislead users. | State tests cover each label, no project-file claim follows a journal-only write, and an accessibility announcement explains failure or recovery. |
| Make file ingress state explicit: selected, inspecting, compatible, opening, open, read-only, rejected, and failed.             | A compatible result is not an open project.                                                                                   | File-open test proves transitions and no editing surface becomes active before an open project context exists.                                    |
| Add a recovery decision surface after refresh or crash.                                                                         | Silent replay can surprise users; lost work destroys trust.                                                                   | Browser restart test offers recover, discard, and diagnostic-safe outcomes.                                                                       |
| Make destructive actions name scope, permanence, and recovery option.                                                           | Project, journal, cache, and file deletion have different consequences.                                                       | Keyboard, pointer, screen-reader, and cancellation tests pass.                                                                                    |
| Resolve the 3D source conflict before showing a current 3D navigation or marketing control.                                     | A disabled or non-user-reachable surface should not create a false feature expectation.                                       | Conflict record closed, ModelCanvas browser proof, and design review sign-off.                                                                    |

## P1: make direct manipulation dependable

| Recommendation                                                                                               | Risk addressed                                                     | Acceptance evidence                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Define visible selection, hover, snap-candidate, snap-accepted, command-preview, and committed-model states. | CAD mistakes happen when what users see differs from what commits. | Plan canvas fixture compares visible target to committed coordinates and supports pointer plus keyboard paths. |
| Ensure undo/redo labels describe the semantic operation, not a vague internal event.                         | Users need to predict recovery before committing geometry changes. | Command history test confirms undo and redo restore model semantics and status text.                           |
| Keep long-running geometry, import, and file operations cancellable with a clear safe point.                 | A frozen editor invites repeated clicks and duplicate operations.  | Worker cancellation test proves no stale result commits after cancel, route change, or document switch.        |
| Provide durable feedback for expensive work: queued, working, ready, failed, and retry-safe.                 | A spinner alone does not explain whether work or data changed.     | Keyboard focus, screen-reader live region, and timeout or failure tests.                                       |
| Give the plan canvas a no-project and no-selection empty state that teaches one safe next action.            | Empty states are onboarding and error prevention, not decoration.  | Visual and accessibility review against actual workspace modes.                                                |

## P1: make public and product surfaces agree

| Recommendation                                                                       | Risk addressed                                                                        | Acceptance evidence                                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Replace broad marketing claims with capability-scoped copy from Language System 4.1. | Current Pages copy exceeds some user-reachable behavior.                              | Source, rendered artifact, and deployed-site verification pass for the same commit.                                      |
| Remove visible em dashes as part of editorial revision, not a blind rewrite.         | Blind punctuation replacement can damage code, titles, legal copy, or sentence logic. | The rendered public-site scanner reaches zero prohibited visible em dashes and a human copy review confirms readability. |
| Publish feature state only when it is current, qualified, or explicitly planned.     | Library code, proposed ADRs, and demos are easy to overstate.                         | Claim records cite an active-surface state and no open conflict.                                                         |
| Give help and error messages an action plus a consequence.                           | "Something went wrong" is not actionable in a design tool.                            | Copy review checks: what happened, what changed, what did not change, what to do next, and when to seek help.            |

## P2: accessibility and performance quality

These are recommendations until an implementation audit records their current
status.

- Audit keyboard parity for tool selection, canvas selection, context actions,
  dialog dismissal, undo and redo, recovery, import, and destructive actions.
- Verify focus order and focus restoration for panels, dialogs, canvas mode
  changes, and error states.
- Use accessible names for icon-only controls and describe current mode,
  selection count, read-only state, save or recovery state, and progress.
- Respect reduced motion and do not make animation the sole indicator of work,
  selection, or failure.
- Define high-contrast and minimum-target-size acceptance checks for the
  workspace, not only marketing pages.
- Establish a fixture-based budget for first interactive plan edit, render
  frame time, worker latency, memory growth, and large-model behavior.
- Test WebGL context loss and restoration without losing editor state or
  presenting stale visual or picking information.

## Suggested delivery order

1. Close the persistence and file-opening truth gaps before adding more
   promotional product copy.
2. Reconcile the 3D conflict and add a browser contract before expanding the
   3D interface.
3. Add recovery, ingress, selection, and destructive-action browser flows.
4. Install the public-site proof chain and repair current claims.
5. Add accessibility and performance fixtures to the selected-evidence map.
6. Revisit the active-surface register and language claims after every
   capability promotion.

The priority is not visual polish at the expense of data safety. A calm,
truthful state model is the first UI quality feature in a CAD or BIM tool.

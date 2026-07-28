# Semantic UI contracts

High-risk Arq messages are product contracts. They must preserve the exact
object, persistence tier, claim state and available action. A shorter label is
not allowed to erase a material distinction.

## Required message anatomy

For any consequential state, the primary message answers what happened. The
secondary region, visible action or disclosed detail answers the remaining
questions as applicable:

1. What object or scope changed?
2. What exact state is it in?
3. Which persistence, permission or fidelity boundary applies?
4. What remains safe or unchanged?
5. What can the person do next?

Do not force all five into a toast. Persistent risks belong in the relevant
surface, with a clear action. A toast may confirm a completed, non-risky action.

## Compatibility is not opening

`Compatible project` means the inspected file passed the current compatibility
check. It does not mean a project document, working copy, worker, view or editor
session has been created.

Use these distinct phrases:

- `Compatible Arq project` for a preflight result.
- `Opening project` only while a real opening pipeline is running.
- `Project ready` only once the workspace has a usable project context.
- `Opened read-only` only when the implementation has created a readable
  project session with edits disabled.

## Journal, local save and portable file publication

Name the target of persistence in the first line whenever ambiguity is possible.

- `Saved in the local journal` means an append to the current journal target.
- `Recovered from the local journal` means replay restored a working state.
- `Portable .arq file updated` is reserved for a completed native-file write.
- `Synced` is reserved for a current remote revision and must never be inferred
  from a journal or local save.

Never write generic `Saved` when more than one persistence tier is in play.

## Disabled and unavailable controls

The visible control should remain discoverable when it teaches the workflow. Its
reason must identify one category:

- no project is open;
- this build does not include the capability;
- the feature is planned or gated;
- the current role cannot perform the action;
- a required service is unavailable or offline; or
- validation must be resolved first.

Do not use `Coming soon`, `Unavailable`, or `Access denied` without this
specific cause.

## AI proposal controls

`Apply` is available only for a proposal whose base revision is current and whose
validation has no blocking errors. A stale or blocked proposal must say why it
cannot be applied and offer the right next action, such as `Review changes`,
`Regenerate proposal` or `Resolve blocking errors`.

## Accessible names and localisation

The visible label is the accessible name unless extra context is necessary.
When extra context is necessary, preserve the visible label as a contiguous
substring. Use message IDs and typed variables from
`02-canonical/message-contract.json`; do not concatenate translated fragments
that can reorder a state or a file name.

## Decision order and copy order

The message order follows the decision a person needs to make:

1. current state or result;
2. affected object or scope;
3. reason or limit;
4. safe boundary;
5. next action.

Do not open with reassurance, a metaphor or an implementation detail. Do not
repeat the state with a broad promise in a second sentence. If the message does
not help a person decide, act or diagnose, remove it.

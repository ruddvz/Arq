# State language standard

ARQ has many explicit state machines. User copy must preserve their distinctions.

## State copy has three layers

For each state define:

1. **internal state**: stable discriminant used by code;
2. **visible label**: compact product wording;
3. **explanation**: what the state means and what the user can do.

Do not let components invent labels independently.

## Workspace open states

Preferred user meanings:

- `project-loading` → **Opening project**
- `project-ready` → **Project ready** only where a state label is needed; normally show no celebratory status.
- `project-offline-ready` → **Offline · project available locally**
- `project-read-only` → **Read-only**
- `project-recovery-required` → **Recovery required**
- `project-fatal-error` → **Project could not be opened**

A fatal project-open state must not render an empty editor that looks ready.

## Local save states

- `saved-local` → **Saved locally**
- `saving-local` → **Saving locally…**
- `local-save-failed` → **Local save failed**

A local save failure is not a sync failure.

## Remote sync states

- `not-configured` → **Sync not configured**
- `offline` → **Offline**
- `queued` → **Changes queued for sync**
- `syncing` → **Syncing…**
- `synced` → **Synced**
- `conflict` → **Sync conflict**
- `sync-failed` → **Sync failed**

If the project is saved locally while sync is offline, say both facts rather than implying data loss.

## Tool states

Internal tool lifecycle:
inactive → discoverable → armed → previewing → awaiting input → committing → complete/rejected/cancelled.

Visible copy should usually show the active command and needed next input, not the lifecycle word itself.

Good:

- Wall · choose start point
- Wall · enter length
- Applying move…
- Wall was not added

Avoid:

- Tool armed
- State: previewing
- Commit rejected

Those belong in diagnostics.

## AI proposal states

Do not call a proposal “done” before apply.

Preferred labels:

- Generating proposal…
- Proposal ready
- Checking proposal…
- Proposal has blocking errors
- Ready to apply
- Applying proposal…
- Proposal applied
- Proposal rejected
- Proposal is stale

A stale proposal must explain that the project changed since the proposal's base revision.

## Long tasks

Use a controlled task vocabulary:

- Queued
- Running
- Paused
- Cancelling
- Cancelled
- Completed with partial results
- Completed
- Failed

Progress copy must say what task is running.

Bad: `48%`
Good: `Converting floor-plan.dxf… 48%`

## Stale state

“Stale” means generated/derived/requested information no longer corresponds to the current project revision.

Do not use “outdated” when the system specifically means revision-stale.

Explain the trigger where useful:

> This proposal was generated for an earlier project revision. Generate a new proposal before applying changes.

## Disabled versus unavailable

These are not synonyms.

- **Disabled**: control is visible but temporarily cannot run.
- **Unavailable in this build**: capability is not implemented/reachable.
- **Requires permission**: user role blocks it.
- **Unavailable offline**: requires remote service.
- **Blocked by validation**: product state prevents it.
- **Not configured**: capability could exist but setup is absent.

Always give the actual category.

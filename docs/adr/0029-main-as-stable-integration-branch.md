# ADR-0029: `main` as the stable integration and production branch

**Status:** Accepted
**Date:** 2026-08-04
**Accepted:** 2026-08-04 by the project owner, in the blocker-closure authorisation
**Owners:** Release owner, repository owner
**Decision:** Adopt `main` through a reversible migration; keep the current branch until the rollback window closes

## Context

The repository's default branch is `claude/arq-cad-platform-research-ba8rav`. It
is an agent-generated session name that became load-bearing by accident: it is
the default branch, the base of every open pull request, the branch the Pages
deployment workflow triggers from, and the branch external integrations clone.

That name is a liability for three reasons. It reads as a scratch branch, so a
reviewer cannot tell from the name that it is production. It encodes one
session's topic, which no longer describes what the branch contains. And any
tool or person who assumes `main` exists is silently wrong here.

Renaming a default branch is not a rename in practice. It retargets workflow
triggers, pull request bases, branch protection, deployment sources, and any
external integration that resolved the old name. Doing it in one step, with no
way back, is how a repository loses its deployment path.

## Decision

Adopt `main` as the stable integration and production branch through a
migration that is reversible at every step.

1. Create `main` from the current default branch head. No history is rewritten
   and no commit is lost; `main` starts as a fast-forward equal.
2. Retarget the workflows that name the branch explicitly, and confirm every
   workflow that triggers on the default branch still triggers.
3. Retarget open pull requests to `main`.
4. Change the repository default branch to `main`.
5. Apply protection to `main` and keep the required-check set that the old
   branch had, adding nothing new in the same step.
6. Keep `claude/arq-cad-platform-research-ba8rav` in place, unprotected and not
   deleted, for the rollback window.
7. Close the rollback window only after a production deployment from `main`
   passes its post-deployment verification.

## Rollback

Within the window, reverting is changing the default branch back and restoring
the previous protection. Because step 1 creates `main` as an equal rather than a
rewrite, the two branches share history and no work is stranded on either side.
Any commit that landed on `main` during the window is reachable and can be
merged back.

Outside the window, once the old branch is deleted, rollback is recreating it
from the shared commit and repeating the retargeting in the other direction.

## Consequences

- The default branch name stops implying that production is a session scratch
  branch.
- One migration step is externally visible: contributors with the old branch
  checked out must set a new upstream. That is a one-line change and is the cost
  of the rename.
- The deployment workflow's branch trigger must be verified after the change
  rather than assumed. A deployment path that silently stops triggering is the
  main failure mode of this migration, so it is an explicit verification step
  rather than a consequence to notice later.
- Branch protection is applied to `main` with the set the old branch already
  had. Making a check required for the first time is a separate decision with
  its own exit criteria, so that the migration cannot be blamed for a gate that
  was never green.

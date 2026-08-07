---
source_id: ARQ-OS3-GITHUB-PROTOCOL
source_type: change-control
class: C
status: proposed-for-repository-adoption
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ engineering owner
---

# GitHub change-control protocol

## Before any write

Record:

- repository and connector account;
- user-requested action;
- base branch and immutable base SHA;
- current head and working-tree state;
- unrelated changes;
- affected packages and files;
- accepted ADRs and conflicts;
- ZEUS contract;
- Engineering OS lane and required evidence;
- Language System impact;
- rollback and recovery;
- exact external action to be performed.

Do not infer consent from connector permissions.

## Branch policy

Use a stable, accepted integration branch for production development. Feature branches should be scoped, short-lived, and based on the current intended integration SHA. Do not force-update a shared branch. Do not reset or overwrite unrelated work.

The current observed default branch has a temporary Claude branch name. Resolve this through an explicit repository decision before renaming or changing production integration.

## Pull request policy

Every non-trivial change should provide:

- outcome and non-goals;
- base and head SHA;
- affected surfaces;
- architecture, data, migration, security, performance, accessibility, and language impact;
- tests and actual results;
- evidence artifacts;
- known failures and proof gaps;
- rollout and rollback;
- screenshots for changed visual surfaces;
- deployment evidence when applicable.

A PR description is not evidence. It indexes evidence.

## ADR integrity

Before adding an ADR:

1. list accepted, proposed, and open ADR IDs from the current base;
2. detect ID and topic collisions across open PRs;
3. allocate the next valid ID on the rebased branch;
4. preserve accepted IDs;
5. update indexes, decision registers, source context, and supersession links;
6. add a CI check that rejects duplicate IDs and inconsistent status or title mappings.

### Immediate P0

Draft PR 280 collides with merged ADR-0027. Rebase it and renumber the proposed desktop-shell decision to the next valid ID. Do not rename the merged MCP ADR.

## Ruleset recommendation

After a shadow rollout, protect the stable integration branch with:

- pull request required;
- required, uniquely named checks;
- Engineering OS gate required;
- Language System gate required when applicable;
- no force pushes;
- no branch deletion;
- review dismissal on new commits where appropriate;
- up-to-date head or merge queue when required by the team's workflow;
- restricted bypass with an auditable owner;
- deployment requirement for production promotion where supported.

Do not make a shadow or known-red gate required until its expected failure model and proof-gap policy are accepted.

## Dependabot and automated branches

Dependency PRs must pass the same source, licence, build, test, security, and regression controls appropriate to their changed surfaces. Automated origin does not lower the lane.

## Completion states

- Local Green: local requested checks pass, no remote write claimed.
- PR Ready: branch pushed, PR exists, required checks selected, known failures stated.
- Merge Eligible: required checks and approvals pass on current head.
- Merged: merge commit or squash SHA observed.
- Released: identified deployment or release from the merged SHA passes release evidence.

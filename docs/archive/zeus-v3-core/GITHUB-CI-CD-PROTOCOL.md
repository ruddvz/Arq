# GitHub, CI/CD and Production Protocol

## Tool order

1. Use an available GitHub connector for repository, PR, checks, workflow jobs/logs,
   artifacts and merge operations.
2. Use authenticated `gh` CLI when a connector is unavailable.
3. Use local `git` for worktree, diff and branch evidence.
4. Use deployment-provider APIs/connectors when available.
5. If no source represents deployment state, report it as Unknown/Blocked.

## Repository preflight

Discover repository, default branch, current branch, base/head SHA, dirty/untracked
files, upstream, open PR, branch protection, CODEOWNERS, workflows, package scripts and
deployment configuration.

## Pull request rules

- Draft until implementation and local evidence are complete.
- Body contains outcome, scope/non-goals, decisions, risk, tests, screenshots or
  artifacts, migration/rollback and limitations.
- Changed files are inspected for unrelated modifications.
- Review must apply to the current head SHA.
- Resolve review threads or document accepted deferrals.

## CI failure triage

Inspect workflow → job → failed step → logs → artifacts.

Classify:

- deterministic code/test failure;
- flaky/non-deterministic;
- runner/infrastructure outage;
- permissions/secrets/configuration;
- dependency/supply-chain;
- policy/security gate;
- timeout/resource budget;
- visual baseline mismatch;
- deployment-provider failure.

Do not rerun deterministic failures without a change. Do not suppress a test, increase
a threshold or update a baseline merely to obtain Green.

## Merge guard

Merge requires:

- explicit authority;
- expected head SHA;
- non-draft and mergeable PR;
- no unresolved required review;
- all required checks successful;
- security/license/migration/visual evidence where applicable;
- rollback and production owner identified.

Preferred merge method is repository policy; never hardcode squash if the repository
requires another method.

## Post-merge watch

Monitor default-branch CI and deployments associated with the merged SHA. Distinguish
queued, in_progress, success, failure, cancelled, skipped and stale states.

Confirm:

- deployed environment;
- deployment SHA equals merged SHA;
- production URL/health source;
- smoke checks;
- error/latency signals during observation window.

## Failure after merge

If a critical regression is confirmed:

1. stop further rollout when supported;
2. open incident state;
3. choose rollback or forward fix based on recovery time and risk;
4. preserve logs/artifacts;
5. verify restored production;
6. document root cause and prevention.

## Permission failure

Repository-level “push” visibility does not prove the connected integration has
contents, actions, pull-request or deployment write scopes. Make one representative
write attempt, then stop repeated calls and produce the exact patch/commands.

# End-to-End Delivery Lifecycle

## State machine

`intake → compiled → evidence_ready → planned → branch_ready → implementing →
local_green → review_green → pr_open → ci_running → ci_green → merge_authorized →
merged → deployment_running → production_verified → closed`

Exceptional states: `blocked`, `failed`, `rolled_back`, `incident_open`.

## 0. Intake

Capture requested outcome and requested stop point. “Implement” includes code and local
verification. “Ship” includes merge and production verification unless explicitly
limited.

## 1. Compile

Run the prompt compiler. Infer quality language into concrete evidence. Establish
scope, non-goals, risk and authority.

## 2. Evidence ready

Inspect repository, current decisions, existing systems and relevant public facts.
Record contradictions and unknowns.

## 3. Plan and roles

Build a dependency graph, assign one accountable owner and required reviewers. Resolve
blocking ADRs before implementation.

## 4. Branch ready

Inspect worktree. Preserve unrelated changes. Create a scoped branch/worktree. Record
base and head SHA. Do not write to the default branch by convenience.

## 5. Implement

Work in dependency waves. Keep operations atomic. Add tests at the correct boundary.
Continuously inspect actual runtime/visual output.

## 6. Local green

Run targeted tests first, then risk-appropriate broad gates. Generate required
artifacts: screenshots/diffs, benchmark data, `.arq` reopen evidence, export reports,
security output or migration logs.

## 7. Review green

Run independent domain, security, accessibility, pixel and QA review. Apply the Senior
Quality Gate. Fix every material in-scope defect and rerun evidence.

## 8. Pull request

Open draft PR while incomplete. Include outcome, decisions, risk, test evidence,
visuals, migration/rollback, known limitations and issue link. Ensure changed files
match scope.

## 9. CI supervision

Monitor required workflows. For failure:

1. identify failed workflow/job/step;
2. fetch logs and artifacts;
3. classify deterministic code/test, flaky, infrastructure, permission/configuration
   or security/policy failure;
4. fix root cause;
5. re-run only the affected scope when valid;
6. confirm new head and all required checks.

A blind re-run is allowed at most once only when evidence supports a transient failure.

## 10. Merge gate

Require explicit merge authority, non-draft PR, expected head SHA, mergeability,
required checks, required reviews, security/visual/migration evidence and rollback.
Never merge a stale reviewed head.

## 11. Deployment

Monitor post-merge workflows and deployment records. Confirm environment and deployed
SHA. A successful build without successful deployment is not Green.

## 12. Production verification

Run configured smoke checks and critical Arq workflow probes. Inspect error telemetry
and rollback triggers for the observation window.

## 13. Closure

Record merged/deployed SHA, evidence, resolved critique, remaining P1/P2/P3 work and
incident/rollback state. Close only at the requested stop point.

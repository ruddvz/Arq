# Engineering OS: shadow to required, exit criteria and rollback

The Engineering OS gate (`.github/workflows/engineering-gate.yml`) runs in
shadow mode. It computes a real decision on every pull request and that decision
is not a required check, so a red gate does not block a merge.

Shadow mode was correct while the gate could not pass for a reason that had
nothing to do with the change under review. Until 2026-08-04 it could not:
`e2e_arq_open` was a declared proof gap, so every diff that selected it failed
no matter what it contained. Making a permanently-red check required does not
raise quality. It teaches everyone to merge past a red check, and then the check
is decorative even after it starts working.

That reason no longer holds. This records what has to be true before the gate
becomes required, and how to reverse it.

## Where the gate stands

At `cfcf2ac` the gate selected 30 evidence items and passed 30, with
`e2e_arq_open` recorded as `available` rather than as a proof gap. That is one
green run, on one diff, and one run is not a rollout criterion.

## Exit criteria

All five must hold before the gate is made required.

1. **Ten consecutive green runs on merged pull requests**, across at least three
   different classifier lanes. One green run proves the gate can pass. Ten
   across lanes proves it passes for reasons that generalise rather than for one
   diff shape.
2. **No evidence item in the catalog is in a `proof-gap` or `missing` state that
   any current lane can select.** `e2e_import_export` is still a proof gap. It
   must either be closed the way `e2e_arq_open` was, or be removed from the
   lanes that select it, with that removal recorded as a decision rather than
   quietly edited.
3. **`protected_l4_approval` resolves to a real approval.** It currently reports
   `success` with state `requires-github-environment`, which is a deferred gate
   rather than an approval anybody granted. Required status must not be
   introduced while one of the gate's own items is a placeholder, because that
   is exactly the shape that makes a required check meaningless.
4. **A deliberately failing change is proven to be blocked.** Open a pull
   request that violates one selected evidence item, confirm the gate reports it
   and that the merge button is actually blocked, then close it. Without this,
   "required" is a setting nobody has observed working.
5. **A documented path exists for a legitimate emergency.** Who can bypass, how
   the bypass is recorded, and how it is reviewed afterwards. Without one, the
   first genuine incident is resolved by turning the gate off, and it stays off.

## Order of operations

Making the gate required is one setting change and is reversible in seconds, so
it goes last, after the branch migration in ADR-0029 has settled. Doing both at
once means a failure cannot be attributed to either.

1. Complete the ADR-0029 migration and confirm the deployment path still runs.
2. Confirm criteria 1 through 5.
3. Add `engineering-gate` to the required checks for the protected branch.
4. Watch the next five merges. A gate that becomes required immediately before a
   quiet period has not been observed under load.

## Rollback

Remove `engineering-gate` from the required-check set. This takes effect
immediately, does not rewrite history, and does not affect any run that already
completed. The gate keeps computing and publishing its decision in shadow mode.

Rollback is expected in one case in particular: if the gate starts failing for
environment reasons rather than for the diff under review, such as a browser
install failing on the runner. That is a measurement failure, not a quality
signal, and blocking merges on it is worse than not blocking at all. Roll back,
fix the instrument, and restart the ten-run count.

---
name: zeus-task-state-machine
version: 5.0.0
project: Arq
---

# Task state machine

Zeus 4 had budgets for repair rounds but no explicit notion of where a run currently
was, so a run could loop, or drift past its delivery stop, without either being visible.

## States

```
classified -> scoped -> executing -> verifying -> repairing -> delivered
                 |          |            |            |
                 +----------+------------+------------+---> blocked
                                                      +---> failed
                                                      +---> rolled-back
```

| State         | Entered when                                           | Leaves when                                 |
| ------------- | ------------------------------------------------------ | ------------------------------------------- |
| `classified`  | The contract is compiled.                              | Scope and authority are confirmed.          |
| `scoped`      | Modules, methods and sources are chosen.               | The first change is written.                |
| `executing`   | Editing has begun.                                     | The slice is complete.                      |
| `verifying`   | Checks are running.                                    | Every claim has a state.                    |
| `repairing`   | A check failed.                                        | The cause is fixed, or the budget is spent. |
| `delivered`   | The delivery stop is Green.                            | Terminal.                                   |
| `blocked`     | Progress needs an owner, credential or decision.       | Terminal for this run.                      |
| `failed`      | Evidence contradicts the goal and repair is exhausted. | Terminal.                                   |
| `rolled-back` | A delivered change was reverted.                       | Terminal.                                   |

## Rules

1. **Never skip `verifying`.** Going from `executing` straight to `delivered` is the
   single most common way an untrue completion claim gets made.
2. **Repair is bounded.** Fast allows 2 rounds, standard 3, deep 5
   (`.zeus/config.json`). A round that produces no new evidence does not count as
   progress and does not earn another round.
3. **Do not pass the delivery stop.** A run whose stop is `local-green` does not open a
   pull request. A run whose stop is `pr-open` does not merge. Escalating the stop is a
   new instruction from the operator, not a reward for going well.
4. **`blocked` is a real outcome.** Reporting blocked with a named owner is a success.
   Inventing a workaround around a missing authority is not.
5. **Re-classify on surprise.** If execution reveals the work is persistent, public or
   production when the contract said local, stop and re-compile. Discovering the blast
   radius mid-run is exactly when the tier should change.

## Recording it

The run state lives in `.zeus/run-state.json` against `.zeus/run-state.schema.json`, and
the evidence for each claim lives in the ledger. The state machine says where the run
is; the ledger says what it has actually established. Both are needed: a run can be in
`delivered` and still have a ledger full of `inferred`, and that combination is a defect
this system exists to make visible.

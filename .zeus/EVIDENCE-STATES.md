---
name: zeus-evidence-states
version: 5.0.0
project: Arq
---

# Evidence states

Zeus 4 graded a whole run: green, partial, blocked, failed, rolled_back. That is the
right vocabulary for a run and the wrong granularity for a claim. A run could be
reported green while several of the sentences inside the report were guesses, because
there was nowhere to record that a particular sentence had never been checked.

Zeus 5 makes every claim carry its own state.

## The seven states

| State                | Means                                                 | Requires                              |
| -------------------- | ----------------------------------------------------- | ------------------------------------- |
| `verified`           | A command ran and its real output supports the claim. | command, exit code                    |
| `partially-verified` | Some but not all of the claim is covered by evidence. | what is covered, what is not          |
| `inferred`           | Read from code or artifacts, not executed.            | the sources read                      |
| `assumed`            | Taken as true to make progress.                       | the reason, and what would falsify it |
| `blocked`            | Cannot be established here.                           | the blocker and its owner             |
| `not-inspected`      | Inside scope, not looked at.                          | the reason it was skipped             |
| `failed`             | A command ran and contradicted the claim.             | command, exit code, output            |

Only `verified` counts as Green. `not-inspected` is an honest answer and is never a
quiet omission: leaving a claim out of the report entirely reads as approval.

## Rules

1. A claim that a check passes is `inferred` at best until the command and its output
   exist. "The tests should pass" is not evidence.
2. A cached result for a protected gate is downgraded to `partially-verified`. Cache is
   a local-feedback optimisation, not proof of a release candidate.
3. `assumed` and `inferred` are legitimate. Presenting either as `verified` is not.
4. Two authoritative sources that disagree produce an open conflict, not a decision.
   Record it and keep the weaker claim until an owner resolves it.
5. A run is Green only when every entry is `verified` and no conflict is open.

## Using the ledger

```bash
node scripts/zeus.mjs evidence init --task "harden the migration path" --stop local-green
node scripts/zeus.mjs evidence add --claim "arqfs tests pass" --state verified \
  --command "pnpm test --filter @arq/arqfs" --exit 0
node scripts/zeus.mjs evidence add --claim "3D tab is user reachable" --state not-inspected \
  --reason "no browser capability check exists for that surface"
node scripts/zeus.mjs evidence report
```

`report` exits non-zero unless every entry is `verified`, so it can gate a script
without anyone having to remember to read it.

The schema is `.zeus/evidence-ledger.schema.json`. Ledgers are per run and belong in
`.zeus/`, which is git-ignored for run artifacts.

## Relationship to run status

The run status stays green, partial, blocked, failed or rolled_back. It is derived from
the ledger rather than asserted independently:

- any `failed` entry, or a failed protected gate, gives `failed`;
- any `blocked` entry gives `blocked`;
- all entries `verified` and no open conflict gives `green`;
- anything else gives `partial`.

# Zeus and Engineering Authority

Zeus 4.0 and Engineering OS 5.0 serve different jobs. Keeping that boundary
clear prevents a helpful local assistant from becoming an unreviewed release
authority.

| System                  | May do                                                                                                                              | Must not do                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Zeus 4.0                | Interpret a developer task, suggest likely surfaces, run local advisory checks, and explain context.                                | Lower a lane, mark a missing test as passed, act as a required GitHub check, or approve a critical change. |
| Engineering OS 5.0      | Classify the base-to-head diff, select minimum evidence, block stale context, record proof gaps, and require protected L4 approval. | Invent product truth, replace source ownership, or bypass Language System claim controls.                  |
| Arq Language System 4.1 | Control canonical terms, public claims, answerability, conflicts, and rendered/deployed public copy.                                | Declare a technical check or protected approval passed.                                                    |

## Required relationship

1. The Engineering OS classifier runs on a real base-to-head diff.
2. Zeus may propose a semantic escalation with a reason and evidence. It may
   only add impacts or raise the lane.
3. The final Engineering OS bundle records deterministic impacts, semantic
   additions, selected evidence, job outcomes, and approval outcome.
4. Any change that affects a public claim invokes Language System validation.
5. A conflict record blocks a current-tense claim until a designated owner
   resolves it in source and the corresponding proof closes.

## Why Zeus cannot be the gate

The current Zeus impact command reads local worktree state and task-language
classification. That is useful while developing, but it is not a reliable
base-to-head review boundary and it is not wired as branch protection. Its
five-minute check cache is also appropriate for local feedback, not proof of a
release candidate.

Engineering OS 5.0 fixes the missing boundary by classifying explicit changed
paths from the platform base SHA to head SHA. It makes its rules, dependency
edges, fixtures, and selected evidence visible in the final result.

## Integration rule

Do not delete Zeus as part of this installation. Add an explicit note in the
repository that Zeus is advisory, then make the stable `engineering-gate`
workflow the required check only after a shadow rollout. A local Zeus result
can be included as supplemental context in a pull request, but it cannot be
used to change a deterministic result.

## Shared failure policy

If Zeus, a reviewer, and the deterministic map disagree, use the most
conservative result while the map is corrected. Add a regression fixture when
the deterministic map changes. Never resolve disagreement by weakening a rule
without evidence.

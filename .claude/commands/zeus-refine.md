---
description: Review this session for durable lessons and propose continual-harness edits
---

Run Zeus's continual-harness refinement over the current trajectory. This is the gate
that turns a finished task into learned state. It is deliberately two stages, and most
sessions should end at stage 1 with "no refinement": a harness that absorbs every
session becomes noise, stops being read, and costs context on every turn for nothing.

Never edit `CLAUDE.md`, `AGENTS.md` or anything under `.zeus/` here. Base doctrine is
owner-held and immutable to this command. The harness is supplemental only, and
`.zeus/FAST-KERNEL.md` still wins on any conflict with an entry.

## Stage 1: the review gate

Look back over this session and decide whether it produced anything worth keeping.
Answer in this exact shape, in the reply, before doing anything else:

```json
{ "shouldRefine": false, "rationale": "short reason", "instructions": "what to capture" }
```

Approve only when the trajectory holds evidence useful to a **future** session. Reject:

- one-off noise, transient tool output, and anything specific to this branch;
- an unsupported hypothesis, or a lesson you did not actually verify;
- a restatement of something `.zeus/` doctrine or an existing entry already says
  (check with `pnpm zeus:harness list` first, and check the kernel);
- "we fixed a bug". The fix is in git. A lesson is the _rule_ that would have
  prevented it.

If `shouldRefine` is false, say so with the reason and stop. That is a complete,
successful run of this command, not a failure.

## Stage 2: the refinement

Pick the smallest component that carries the lesson:

| Kind       | Use for                                                  | Requires                              |
| ---------- | -------------------------------------------------------- | ------------------------------------- |
| `prompt`   | a narrow behavioural rule Zeus should follow from now on |                                       |
| `memory`   | a durable fact, decision, failure or preference          |                                       |
| `skill`    | a repeatable procedure worth naming                      | `reference` (command or script path)  |
| `subagent` | a reusable delegation role                               | content stating **when to invoke** it |

Rules that keep the store worth reading:

- **Evidence is mandatory.** Cite the file, command, commit or test that proves it.
  `applyProposal` refuses an entry without evidence, because
  `.zeus/EVIDENCE-STATES.md` says confidence is not evidence.
- **Prefer update over create.** A sharper version of an existing entry beats a second
  entry saying nearly the same thing.
- **Retire what a new lesson supersedes**, in the same proposal.
- **Never persist a sensitive value**: a key, token, credential or contact address. The
  vocabulary is fine, the value is not, and the store refuses it.
- **Lane** is `general` or a module id from `.zeus/module-manifest.json`.
- Write the content as an instruction to a future Zeus turn, not as a diary entry.

Write the proposal to `.zeus/harness/proposal.json` in this shape:

```json
{
  "summary": "one sentence",
  "rationale": "why these edits are justified by trajectory evidence",
  "expectedOutcome": "what should improve, and how to validate it",
  "edits": [
    {
      "action": "create",
      "kind": "prompt",
      "title": "short imperative title",
      "content": "the rule, written for a future session",
      "evidence": "file, command, commit or test that proves it",
      "lane": "general"
    }
  ]
}
```

Then, in this order:

1. `pnpm zeus:harness apply --file .zeus/harness/proposal.json --dry-run`
2. Show the proposal in full in the reply, so the owner sees the exact edits.
3. `pnpm zeus:harness apply --file .zeus/harness/proposal.json`
4. `pnpm zeus:drift` and `bash scripts/test-zeus-hook.sh`. The store feeds the hook, so
   a bad entry is a hook problem and not only a data problem.
5. Delete `.zeus/harness/proposal.json`; the refinement event is the record.
6. Report the refinement id and the exact rollback command.

Every edit is reversible, including a rollback:
`pnpm zeus:harness rollback --id <refinement-id>` restores the entry set exactly as it
was before that refinement.

$ARGUMENTS

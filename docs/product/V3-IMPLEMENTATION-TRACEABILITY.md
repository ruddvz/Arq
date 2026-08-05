# ARQ CAD System Implementation Pack 3.0 — traceability

`V3-IMPLEMENTATION-TRACEABILITY.csv` maps all 205 tasks in the pack's
`machine/backlog-v3.csv` to where each was addressed, or to why it was not.

It exists because the backlog is not in this repository — it arrived as a
delivery pack — so without this file a reviewer has no way to check the claim
that a given task was done, and no way to see which ones were not. A list of
commits does not answer that: several tasks land in one commit, and several
commits contribute to one task.

## How it was built

Generated and **verified**, not written by hand. Each row names an evidence path
and a symbol that must appear in it; the generator fails if the file is missing
or the symbol is absent, so a row cannot claim something the repository does not
contain. It failed once during authoring — a job that lives in
`security.yml` rather than `ci.yml` — which is the check doing its job.

Verification is existence, not correctness. A row proves the module named is
present and exports what the row says; it does not prove the module is right.
The tests do that, and they are what CI runs.

### The symbol used to be optional, and that was the hole

Thirty-five rows once passed on nothing but "this path exists". That is how four
P2 rows came to name `workers/import-export-worker` for tasks that live in the
_arqfs_ Worker — a different worker, a different protocol, a different file — and
verified clean anyway, because the path they named did exist. The rows were
wrong and the check agreed with them.

A symbol is now required. A row that cannot name something specific in the file
it points at fails the build rather than being written down. This would not have
caught the mis-pointed rows on its own — `worker-runtime.ts` has symbols too —
but it removes the class of row that is unfalsifiable by construction, and
naming a symbol forces whoever writes the row to open the file.

The four rows were found by reading them, not by running the generator. That is
the honest limit of this artifact: it can prove a row is not lying about the
repository, and it cannot prove a row is answering the right question.

## Dispositions

| Disposition                  | Count | Meaning                                                                                                                                                                                                                |
| ---------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `implemented-in-this-change` | 116   | Written on this branch. The evidence path is a module added or substantially changed here.                                                                                                                             |
| `pre-existing`               | 57    | Already satisfied at the branch point, mostly by the ARQ-era work in P1–P3. Checked rather than assumed: each names a file and symbol that exists today.                                                               |
| `owner-authority`            | 28    | P0's verification steps and P14's release steps, plus workflow pinning and build provenance. These change GitHub settings, Vercel configuration, repository visibility or production state, and none of them are code. |
| `blocked-no-evidence`        | 3     | V3-107 and V3-108 need benchmarks in a real browser against a real SQLite build; V3-117 needs SolveSpace or libslvs built to compare against. Guessing the numbers would be worse than leaving them open.              |
| `implemented-differently`    | 1     | V3-032 — see below. The purpose is met somewhere other than where the task says to put it, deliberately.                                                                                                               |

### `pre-existing` was audited, and it did not hold

It was the disposition flagged here as most worth reading sceptically, on the
grounds that it meant "the repository already had the module the task names",
not "the task is finished". Reading all 65 of them rather than trusting that
caveat moved eight rows and found five real defects, each now fixed on this
branch:

- **V3-012, V3-015** — `acquire` discarded the outgoing project, so a failed
  replacement could not offer back what it replaced.
- **V3-019** — import progress and staging events carried no request id, so a
  slow first import could drive the second one's UI.
- **V3-029** — cancelling a request that was not in flight leaked its id
  permanently, and a reused id would swallow the new request's final message.
- **V3-031** — seven structurally different import rejections reached the caller
  under one code, including the source-changed-underneath-us one.
- **V3-021** — neither Worker validated its incoming message. `handleArqfsWorkerRequest`
  returned `undefined` for an unrecognised type and the Worker posted that, so
  the caller waited out a timeout for a request refused on arrival.

The lesson is about the disposition, not the tasks: "the module exists" and "the
task is done" are different claims, and only the first one was ever checked.

### V3-032, and why it is not `pre-existing`

The task asks the Worker protocol to carry a request id, a project id and a
revision. It carries the request id. The other two are met elsewhere, on
purpose, and calling that `pre-existing` would paper over a real design
divergence:

- **Project id** is bound at Worker construction (`?project=<id>` in the Worker
  URL, read by `readProjectIdFromWorkerSearch`), not per message. One Worker
  serves one project, so the correct file is selected before the first request
  can race it — a per-message field would be a second, weaker place for the same
  fact to be wrong.
- **Revision** gating lives at the operations layer, where `staleBaseRevision`
  in `operation-pipeline.ts` already refuses a commit computed against a stale
  base. Repeating it in the byte-store protocol would make two sources of truth
  for one rule.

Both are defensible; neither is what the task literally asked for. The row says
so rather than quietly claiming the task.

## What this file is not

It is not an acceptance record. The pack's `machine/acceptance-matrix-v3.csv`
lists 114 acceptance criteria with their own evidence requirements, and several
of those need evidence that cannot be produced from a repository check — a
browser observation, a deployed route, a human approval. This file says where
the work is, not that a criterion passed.

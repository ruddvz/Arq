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

## Dispositions

| Disposition                  | Count | Meaning                                                                                                                                                                                                                |
| ---------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `implemented-in-this-change` | 109   | Written on this branch. The evidence path is a module added or substantially changed here.                                                                                                                             |
| `pre-existing`               | 65    | Already satisfied at the branch point, mostly by the ARQ-era work in P1–P3. Checked rather than assumed: each names a file and symbol that exists today.                                                               |
| `owner-authority`            | 28    | P0's verification steps and P14's release steps, plus workflow pinning and build provenance. These change GitHub settings, Vercel configuration, repository visibility or production state, and none of them are code. |
| `blocked-no-evidence`        | 3     | V3-107 and V3-108 need benchmarks in a real browser against a real SQLite build; V3-117 needs SolveSpace or libslvs built to compare against. Guessing the numbers would be worse than leaving them open.              |

`pre-existing` is the disposition most worth reading sceptically. It does not
mean the task is finished to the pack's full intent — it means the repository
already had the module the task names, and this change did not need to add one.
Where a pre-existing module was extended here, the row points at the extension.

## What this file is not

It is not an acceptance record. The pack's `machine/acceptance-matrix-v3.csv`
lists 114 acceptance criteria with their own evidence requirements, and several
of those need evidence that cannot be produced from a repository check — a
browser observation, a deployed route, a human approval. This file says where
the work is, not that a criterion passed.

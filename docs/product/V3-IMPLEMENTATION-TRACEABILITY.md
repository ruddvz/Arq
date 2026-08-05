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
| `implemented-in-this-change` | 119   | Written on this branch. The evidence path is a module added or substantially changed here.                                                                                                                             |
| `pre-existing`               | 49    | Already satisfied at the branch point, mostly by the ARQ-era work in P1–P3. Checked rather than assumed: each names a file and symbol that exists today.                                                               |
| `owner-authority`            | 28    | P0's verification steps and P14's release steps, plus workflow pinning and build provenance. These change GitHub settings, Vercel configuration, repository visibility or production state, and none of them are code. |
| `blocked-no-evidence`        | 3     | V3-107 and V3-108 need benchmarks in a real browser against a real SQLite build; V3-117 needs SolveSpace or libslvs built to compare against. Guessing the numbers would be worse than leaving them open.              |
| `implemented-differently`    | 6     | V3-032, V3-035, V3-039, V3-142, V3-143, V3-148 — see below. The purpose is met somewhere other than where the task says to put it, deliberately.                                                                       |

### `pre-existing` was audited, and it did not hold

It was the disposition flagged here as most worth reading sceptically, on the
grounds that it meant "the repository already had the module the task names",
not "the task is finished". Reading all 65 of them rather than trusting that
caveat moved thirteen rows and found eight real defects, each now fixed on this
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
- **V3-038** — a `.arq` file carries `checksums.json`, recording what every other
  entry should hash to. Nothing on the open path read it. `verifyArqfsEntryDigests`
  existed, was tested, and had exactly one caller: publication. So a file this
  build had just written was verified, and a file from anywhere else was adopted
  on trust — a `model.json` edited to still be valid JSON would decode into
  whatever it now said and become the project. Open refuses it now, before the
  archive is parsed.

- **V3-090, V3-092–V3-096** — the eight snap sources and the inference engine
  that ranks them had no path between them. `rankCandidates` took a
  `SnapResult[]` and nothing built one, so every snap module in the package was
  reachable only from its own tests. `inference-engine.ts` said so in its own
  doc comment — "none of them answers the question the drawing tools actually
  ask" — and then supplied the ranking half only. `collectSnapCandidates` is the
  generation half, and its first test asserts that every source in the canonical
  priority table can actually be reached through it.

- **V3-030, V3-044** — the single-writer lock (ADR-0024) was never acquired.
  `acquireSingleWriterLock` was written, tested and exported, and had no caller
  outside its own tests, so `readOnly` came only from the file's writer-version
  floor. Two windows could open the same project writable and each believe it
  was the writer. The lease is now taken before the Worker is constructed — so a
  contended project is not first imported into a working copy another context
  holds — and released when the session closes or the open fails. It also
  needed a read-only cause of its own: telling someone their file is too new,
  when what actually happened is that they have it open in another tab, is a
  wrong answer to the only question they are asking.

The lesson is about the disposition, not the tasks: "the module exists" and "the
task is done" are different claims, and only the first one was ever checked. The
sharpest cases are V3-038, V3-090 and V3-030, where the modules existed, were
correct, were well tested, and were wired to nothing that needed them. V3-030 is
the one to remember: the unwired module was the one enforcing a safety property
an ADR specifies, and the suite stayed green throughout, because a lock nobody
takes breaks no test.

The check that found all three was not the generator. It was asking, for each
row's symbol, whether anything outside its own file and tests referred to it. A
module with no caller can pass every test it has and still not be part of the
product.

Several P3 rows also named the wrong file — `stages.ts`, a 13-line table of
open-stage descriptors, was cited as evidence for "validate hostile semantic
inputs" and "adopt candidate atomically". They now name
`open-native-project.ts` and `native-project-model.ts`, which is where that work
actually is.

### The three `implemented-differently` rows

Each of these is a task whose purpose the repository serves, in a place the task
did not name. They are called out rather than filed as done, because "we did
something else instead" is a claim a reviewer should get to disagree with.

**V3-035, "verify staged byte identity before open."** The bytes are staged into
an `opfs-sahpool` working copy, and that VFS does not keep the database at the
filename it was handed — it lives inside a pool of opaque files the utility
manages. There is no staged file to read back and compare, so byte-identity
verification is not available through this VFS at all. What runs instead is
stronger against the threat the task is aimed at: the file's own recorded
per-entry digests are verified after open (V3-038), which checks that what was
opened is what the file says it should be, rather than that a copy matched a
copy.

**V3-039, "verify semantic hash."** The hash is computed at open and carried on
the snapshot, and it is not verified, because there is nothing to verify against
— no manifest, schema or file records an expected value, as
`arqfs-semantic-hash.ts` says in its own comment ("no digest is persisted in any
schema, any file or any manifest"). Reporting this as a verification would
describe a check that cannot run. What the computed hash is actually for is
`@arq/derived-cache`, whose freshness rule compares a stored hash against the
project's current one and had no source for "current" on an opened project.

**V3-142 and V3-143, the iPad landscape and portrait shells.** Both shells
exist, and nothing renders them. That looked like the same unwired-module
finding as V3-030 until the components were read: they are ARQ-030 prototypes,
described in their own doc comments as "a composition of the already-built shell
components, not new controls". `workspace-root.tsx` is the Package 3.0 shell
that replaced them, and it handles both tablet platforms itself —
`resolveWorkspacePlatform` returns `tablet-landscape` and `tablet-portrait`,
`panelDockingPolicy` puts both on drawers, and the root switches its own layout
on them. Wiring the prototypes in would regress the shell to an older
composition, so the rows point at the code that delivers the behaviour today.

**V3-148, the keyboard baseline.** `registerKeyboardBaseline` has no caller, and
the bindings it describes are implemented — `apps/web/src/App.tsx` handles them
directly, and its comment cites `keyboard-baseline.ts` as the document they came
from. The module's own comment is candid that its entries have "no backing
implementation in this codebase yet". The behaviour is delivered through
`shouldHandleShortcut`; the registry helper is not on that path.

These two are worth stating plainly because they are what the caller-reachability
check looks like when it is _wrong_. Three of its hits were real defects. Three
were modules that are superseded or bypassed, where wiring them in would have
made the product worse. The check finds candidates, not verdicts.

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

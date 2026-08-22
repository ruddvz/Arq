# Zeus x prime-agent integration: what shipped, and what did not

Final state: **green, with four disclosed limits.** Not "perfect".

Companion documents: `docs/ZEUS-PRIME-INVENTORY.md` is the Phase 0 reading of the
repository that every decision here was made against.

Provenance: the architectural ideas come from `PrimeIntellect-ai/prime-agent` (MIT,
inspected at `f8f0222`) by way of an integration package built for a different
repository. None of prime-agent's runtime is adopted: it is a standalone
Python/IPython CLI agent with its own daemon, TUI and RLM runtime, and Zeus is a
repository-resident operating system driven by Claude Code. Adopting the runtime would
be a category error. The daemon, agent-to-agent messaging, heartbeats, bounded
autonomous mode and automatically applied model-written edits were refused for the same
reason, and that refusal is part of the design rather than an omission.

## 1. What shipped, per phase

### Phase 0: inventory

`docs/ZEUS-PRIME-INVENTORY.md`. Every answer cites a path. It found that two of the
four ideas were absent, one was already present, and one was half present, which
changed the plan: **progressive disclosure was not rebuilt**, only the check that makes
it safe.

### Phase 1: continual harness (absent, built)

| File                                 | What it is                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `scripts/zeus-harness-state.mjs`     | The store: four entry kinds, mandatory evidence, bounded injection, snapshot-per-mutation |
| `scripts/zeus-harness-state.test.ts` | 32 tests                                                                                  |
| `scripts/zeus-hook.sh`               | Rewritten to compute the block before writing, surface a corrupt store, and emit once     |
| `.zeus/config.json` `harness`        | Store path and the five budgets, so nothing is hardcoded                                  |
| `.zeus/harness/state.json`           | The store, tracked; three entries recorded through the refine gate                        |

The failure it fixes was measured here, not assumed: `.zeus/eval-log.jsonl` is written
by `scripts/zeus-eval-record.mjs`, read only by `scripts/zeus-eval-stats.mjs` for
aggregate counts, has no lesson field at all, and was empty. Nothing Zeus learned had
ever reached a later turn.

### Phase 2: refine gate (absent, built)

`.claude/commands/zeus-refine.md`. Two stages, designed to decline: stage 1 emits
`{"shouldRefine": false, ...}` and stops for one-off noise, unverified hypotheses,
restatements of existing doctrine, and "we fixed a bug". A dry run validates the whole
batch against a copy, so a partly valid proposal cannot half-apply.

### Phase 3: progressive disclosure (already present, NOT rebuilt)

Zeus already reads `.zeus/FAST-KERNEL.md` and nothing else by default. What was missing
is the proof that the kernel stays a faithful subset, so only that was built:
`scripts/zeus-drift-guard.mjs` plus `scripts/zeus-drift-guard-test.mjs`.

Six guards, each derived from disk wherever the set can grow:

1. The hook still **runs** the harness format command (invocation, not filename).
2. Every `.claude/commands/zeus-*.md` on disk is skipped by the hook.
3. The kernel still names every mode, tier, blast radius level, reversibility, evidence
   state and configured tier budget, and still carries seven safety statements.
4. The published saving is a checkable floor, guarded from both sides.
5. `CLAUDE.md` still says the rest of `.zeus/` is not loaded by default, so the kernel
   is read INSTEAD of the doctrine set and not in addition to it.
6. Every configured repository gate names a real package script.

### Phase 4: gate ledger (half present, completed)

| File                                  | What it is                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `scripts/zeus-gate-ledger.mjs`        | Fingerprint-bound gate results, tier-bounded rounds, an unconditional floor, a review gate |
| `scripts/zeus-agent-registry.mjs`     | The single definition of "dispatchable", shared by three callers                           |
| `scripts/zeus-reviewer-match.mjs`     | Which reviewer the changed paths actually call for                                         |
| `scripts/zeus-gate-ledger.test.ts`    | 40 tests                                                                                   |
| `scripts/zeus-reviewer-match.test.ts` | 14 tests                                                                                   |
| `.zeus/config.json` `gates`           | Store path, the unconditional gate set, the review risk threshold                          |

Nothing was reinvented. The workspace signature is `scripts/zeus-fingerprint.mjs`. The
round bound is `.zeus/config.json` `budgets.<tier>.repairRounds`. The unconditional gate
set is the one `scripts/zeus-check.mjs` already runs at standard and deep tier. The
review requirement mirrors `scripts/lib/zeus-engine.mjs`: risk at the configured
threshold, or a blast radius level whose `requiresReview` flag is set.

**It closes the reference implementation's largest disclosed gap.** That work shipped a
review gate that any dispatchable agent satisfied, because nothing computed which
reviewer a diff required; it named a path-glob-to-reviewer map as the fix and did not
build one. Arq already had the map. `ship` now refuses a real agent that the changed
paths do not call for, and reports `matched: false` with a stated reason rather than
concluding no review was needed whenever the mapping cannot be computed.

## 2. Verification table

Every row is a command that was run, with its real output.

| Command                                  | Result                                                                               | Pass |
| ---------------------------------------- | ------------------------------------------------------------------------------------ | ---- |
| `pnpm test`                              | 356 files, 4024 tests passed (baseline 352 / 3907; +4 files, +117 tests, 0 failures) | yes  |
| `pnpm typecheck`                         | 37 tasks successful, 37 total                                                        | yes  |
| `pnpm lint`                              | `eslint .`, no output                                                                | yes  |
| `pnpm format:check`                      | All matched files use Prettier code style                                            | yes  |
| `pnpm build`                             | exit 0, 12.1s                                                                        | yes  |
| `pnpm zeus:test`                         | Zeus 5 full system tests passed                                                      | yes  |
| `node scripts/zeus-validate.mjs`         | 13 modules, 98 methods, 38 skills, 7 reviewer agents, 6 blast radius levels          | yes  |
| `node scripts/zeus-verify.mjs`           | passed (29 required files, was 23)                                                   | yes  |
| `node scripts/zeus-drift-guard.mjs`      | drift guards passed                                                                  | yes  |
| `node scripts/zeus-drift-guard-test.mjs` | 16 cases, each guard broken on purpose                                               | yes  |
| `node scripts/zeus-guard-test.mjs`       | 23 cases (unchanged)                                                                 | yes  |

Pre-existing failures in files not touched: **zero, before and after.** The baseline was

The first CI round failed `preflight` and, downstream of it, `engineering-gate`.
Root cause, reproduced locally: Engineering OS hashes a fixed set of
repository-scope files, and the three new `zeus:*` scripts changed `package.json`,
so `engineering/ops/generated/engineering-context-v5.json` went stale. Regenerated
with `pnpm engineering:context:build`; the only field that moved was the
`package.json` hash. The rule that would have prevented it is now a harness entry,
which is what the refine gate is for.
recorded before the first edit and is in `docs/ZEUS-PRIME-INVENTORY.md`.

Acceptance criteria, each proven by a command:

1. A learned entry is visible in a real turn's injected context: the hook's output ends
   with the three recorded entries.
2. The injected block never exceeds its budget, at any budget value: asserted for every
   integer from 0 to 2000.
3. An entry with no evidence is refused: exit 2, "evidence required".
4. Every mutation is reversible, including a rollback of a rollback.
5. A batch where one edit fails leaves the store byte-identical.
6. A corrupt or truncated store produces a visible warning, the hook exits 0 and writes
   0 bytes to stderr, and the turn proceeds.
7. The always-on read is measurably smaller (86.9% against the doctrine set) and three
   drift cases fail if that claim stops being true.
8. A gate recorded before an edit is reported stale after it: one appended newline made
   all five gates stale.
9. `ship` refuses without the unconditional gates and without a review naming an agent
   that exists and matches the diff.
10. Every Zeus verification command passes.

## 3. Guards proven by breaking

`scripts/zeus-drift-guard-test.mjs` holds 22 cases; each breaks one guard in a throwaway
copy and asserts both the non-zero exit and the message. The two that matter most:

- **The bystander-string case.** The hook is edited to `cat` the harness script instead
  of running it, so the filename survives. Weakening `HARNESS_INVOCATION` to a filename
  match makes 2 of 22 cases fail, which is how the invocation match is proven to be the
  thing doing the work.
- **The rewrap case.** `CLAUDE.md` wraps the read-instead-of sentence across a newline.
  A literal-space regex fails the baseline case, so the whitespace-tolerant match is
  proven necessary rather than assumed.

One defect in this work was found by dogfooding it, after the branch was pushed:
`resolveBase` preferred `@{upstream}`, and on a pushed feature branch the upstream is
`origin/<that same branch>`, so `base...HEAD` is empty and every changed path vanishes
the moment the branch is pushed. That is the same fail-open the function exists to
prevent, one step later. It now prefers `origin/HEAD`, refuses a tracking ref that is
the branch's own remote copy, and reports the path set as incomplete rather than empty.
Two tests build a real two-branch repository to pin it, and both fail against the
previous ordering.

Two further guards were broken outside that file:

- The installer's state exclusion: with `.zeus/harness/probe.json` and
  `.zeus/gates/probe.json` present, `install-zeus.sh --dry-run` still lists neither,
  while a bare `find` lists both.
- The Prettier ignore: retiring one entry shortens a `changes` array enough for Prettier
  to collapse it, which failed `pnpm format:check` on a file no human edits. Reproduced,
  then fixed by ignoring the two state directories, then reproduced as passing.

## 4. Tests proven against un-fixed code

Twelve tests were run against a deliberately un-fixed copy of the module they cover, and
all twelve failed as they should. A test that passes either way pins nothing, and two of
the reference implementation's tests were exactly that.

| Un-fix applied                                       | Test that caught it                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| snapshot taken after restoring                       | rolls back a rollback                                                   |
| edits mutate the live entry array                    | leaves the store byte-identical                                         |
| the nothing-fits notice ignores the budget           | never exceeds the budget, at any budget value                           |
| strict sort by kind instead of round robin           | does not starve the other kinds                                         |
| no shape validation on load                          | names the entry and the field                                           |
| no unconditional gate floor                          | will not let a recorded review stand in                                 |
| bound indexed without validating the tier            | falls to the strictest bound, not to unbounded                          |
| `outcome === 'fail'` instead of `!== 'pass'`         | refuses an outcome that is not exactly "pass"                           |
| every unrecognised reviewer reported unconditionally | does not let one typo bury a genuine review                             |
| any dispatchable agent accepted                      | refuses a real agent the changed paths do not call for                  |
| `@{upstream}` preferred over `origin/HEAD`           | refuses a tracking branch that is the branch's own remote copy          |
| `@{upstream}` preferred over `origin/HEAD`           | prefers origin/HEAD, so a pushed feature branch still measures its diff |

## 5. Checked against all 23 known defects

Every defect in the reference catalogue is either fixed and pinned by a test, or does
not apply here. The four with a different shape in Arq:

- **Defect 4 (the ledger was wired into nothing).** Still partial, and disclosed below.
- **Defect 11 (a self-disabling guard).** Arq had no agent-count guard. The equivalent
  trap was reproduced anyway, as the rewrap case above.
- **Defect 19 (two definitions of "dispatchable").** Avoided by construction:
  `scripts/zeus-agent-registry.mjs` is the only definition, and
  `zeus-validate.mjs`, `zeus-gate-ledger.mjs` and `zeus-reviewer-match.mjs` all import
  it. Verified by grep, not by intent.
- **Defects 16 and 17 (tautological tests).** Addressed by the whole of section 4, and
  by asserting both problems in the stale-gate test rather than only "not ready".

## 5b. Round 2: showing the reading, and a self-critique pass

### The reading Zeus shows before it works

The compiler classified every prompt and never said, in words, what it thought the
prompt meant. `intent` existed in the contract JSON and was the raw prompt truncated to
320 characters; `markdown()` never rendered it. So an operator could see `mode: answer`
and still not know that Zeus had read an instruction as a question.

Every actionable turn now opens with:

```
**Zeus reads this as** an instruction to change the repository and verify the change.
**Not as** a request for a plan or a discussion.
**Assumed:** no delivery stop was stated, so Zeus stops at local-green and goes no
further; classified from your words alone; run `node scripts/zeus.mjs impact` once
files change, because paths can raise this.
**Your words:** "Rename a variable in packages/arqfs/src/open.ts"

If that reading is wrong, say so before anything else; do not work from it.
```

Four decisions in that block are load-bearing:

- **It restates, it does not rewrite.** Zeus never turns the request into different
  words and then acts on those. It says how it read the words it was given, and quotes
  them back unedited, so a misread is caught in the first line rather than after the work.
- **The negative half carries most of the value.** "Not as an instruction to change
  anything" is far easier to check at a glance than the word `answer` in a field.
- **It is deterministic and offline.** It runs in the `UserPromptSubmit` hook on every
  prompt, so it cannot call a model, and a restatement that needed one would be the very
  thing it exists to let the operator check.
- **It admits its own inferences.** An assumed delivery stop, a risk held down because
  the request reads as a question, a tier raised by blast radius rather than by size.

One assumption is stated on every change-mode turn because it is always true and was
measured: `Rename a variable in packages/arqfs/src/open.ts` classifies as low risk,
`package` radius, `fast` tier from the words alone, while `zeus impact` puts that same
path at high risk and `persistent` radius once it is a real changed file. Reading a tier
off a prompt and trusting it is a mistake the compiler can warn about.

The second half is doctrine rather than code: `.zeus/FAST-KERNEL.md` now requires the
reply to repeat that reading in the model's own words before executing, and requires any
prompt written for a subagent or another model to be shown in full before dispatch. A
prompt the operator cannot see is a decision they cannot check. Three drift guards keep
both rules present, and a behavioural guard compiles a real task and checks the rendered
output, because a guard that greps the renderer stays green when the field stops being
populated and a guard that checks the field stays green when the renderer stops printing
it.

### Three defects found by attacking the round-1 work

Each was found by running a probe, not by re-reading the code, and each is now fixed and
pinned by a test that fails against the un-fixed module.

**1. The workspace signature depended on the shell's working directory.**
`zeus-fingerprint.mjs` hashes `git ls-files --others` relative to the root it is given,
and the ledger passed `process.cwd()`. Measured: the repository root and `packages/`
produced different signatures for an identical tree, so every gate recorded from one
directory read as stale from the other. A ledger that goes stale for no reason is a
ledger people stop running. It is now rooted at `git rev-parse --show-toplevel`.

**2. A ledger with no blast radius silently waived independent review.**
`--blast-radius` was optional and defaulted to `null`, and the review rule is `risk at
the configured threshold OR a radius that requires review`. So `start --risk moderate
--tier standard` with no radius produced a ledger that shipped green with no reviewer at
all. An unrecorded axis must never read as a benign one. `start` now refuses a radius
that is not in `.zeus/blast-radius.json`, and `reviewRequired` treats a missing radius as
review-requiring, because the ledger is hand-editable JSON.

**3. The tracked harness store grew about 100x larger than the state it carries.**
Every refinement stored a complete copy of every entry as its rollback snapshot, so
growth is quadratic in a store designed to be edited often. Measured on a store filled to
its own 40-entry cap: 811 KB after the seed refinements, **2,385 KB after 40 ordinary
edits**, carrying 24 KB of actual learned state, in a file that is committed, reviewed
and merge-conflict-prone. Snapshots are now kept for the most recent
`harness.rollbackWindow` refinements only; the events themselves are never dropped, so
the history of what changed stays complete. The same 80 refinements now produce 254 KB.
Beyond the window, the store is tracked, so git holds every prior version, and `rollback`
says exactly that instead of failing on an absent field.

### A tautology in the critique itself

The probe that runs new tests against un-fixed modules reported all seven as
tautologies. Seven out of seven is far likelier to be a broken probe than seven useless
tests, and it was: the probe rewrote the test's import with a regex that matched nothing,
so every run used the fixed module. After fixing the probe, six of the seven pinned
correctly and **one was a genuine tautology**: the signature test compared two calls made
from the repository root, where `process.cwd()` already is the root, so it passed against
the cwd-rooted version too. It now changes directory and fails against the un-fixed code.

That is the same class as defects 16 and 17 in the reference catalogue, found the same
way, and it is the reason the rule is "run it against the un-fixed code" rather than
"write a careful test".

### Zeus's own operating surface is now classified

Round 1 disclosed this as the highest-value follow-up and left it to the owner. It was a
real fail-open, measurable on the round-1 diff itself: a change that rewrites the
always-on hook matched no impact pattern, so it named no module, no reviewer, and read as
`local` blast radius.

`.zeus/**`, `scripts/zeus-*`, `scripts/lib/zeus-*`, `.claude/hooks/**`,
`.claude/agents/**`, `.claude/commands/**` and `.claude/settings.json` now route to the
`architecture` module (and `security` for the hooks and settings) at high risk, with a
`product` blast radius. A hook change now names `arq-architecture-reviewer` and requires
review.

**The honest caveat, stated rather than hidden:** `product` is defined as "user-visible
product behaviour across packages", which is not what the agent operating system is. It
was chosen because its _controls_ are right (minimum tier standard, `requiresReview:
true`) and none of the six levels describes "the system every future turn runs on". The
alternative is a seventh level, which renumbers the whole scale and is a vocabulary
decision for the repository owner. Closing a fail-open with a slightly wrong label beats
leaving it open, and re-pointing the rule at a new level later is a one-line change.

### The drift guards now run in CI

Round 1's disclosed limit 3 was that no Zeus check ran in CI at all. `.github/workflows/ci.yml`
now runs `node scripts/zeus-drift-guard-test.mjs`, `pnpm zeus:drift` and `pnpm
zeus:validate` in the `lint-and-typecheck` job. The guard test runs first, on the same
principle the repository already applies to `check:decision-ids:test`: a verifier that
cannot fail would report a clean repository either way.

`pnpm zeus:test` is deliberately still not in CI. It asserts a p95 compile time under
20 ms, which is timing-sensitive on a shared runner and would flake.

## 6. What is NOT done

None of these is solved. Partial must never read as green.

1. **Independent review was not dispatched, and Zeus itself now requires it.** This
   session was explicitly forbidden from using the Agent tool, so no `arq-*-reviewer`
   cleared this work, and the author's own critique is not a substitute. In round 1 this
   was a gap against the integration package's critique gate only, because the diff
   classified as moderate risk and `package` radius. Classifying Zeus's own surface
   changed that: the same diff now reads as **high risk, `production` blast radius**, and
   `pnpm zeus:gate reviewers` names `arq-architecture-reviewer`,
   `arq-release-reviewer` and `arq-security-ai-reviewer`. Zeus's own rule now refuses to
   ship this without them. That is the gate working on its author, and it is the one
   thing that must happen before merge.
2. **Every gate is self-attested.** Recording `typecheck --outcome pass` does not run
   `tsc`. The ledger records a claim about a check, not the check. Closing this needs a
   gate runner that executes the command itself, or CI that owns the ledger.
3. **Most Zeus self-checks still run only on demand.** `pnpm zeus:drift`,
   `pnpm zeus:validate` and the drift-guard regression suite now run in CI, and the 117
   Zeus tests run under `pnpm test`. `pnpm zeus:test` does not, because it asserts a
   timing-sensitive p95. The gate ledger still cannot force itself to be run: it refuses
   when invoked, and it is wired into a command rather than into CI.
4. **The reviewer match is only as good as the impact map.** It is a real match check
   now, but a path no pattern covers produces `matched: false`, which falls back to
   "any dispatchable agent". That is fail-closed rather than fail-open, and it is
   weaker than a match.

Deliberately out of scope, per the integration package: a `ROLES.json`, a gate runner
that executes commands, and anything from prime-agent's runtime.

## 7. Open questions for the repository owner

1. **Does the agent operating system deserve its own blast radius level?**
   `.zeus/`, `scripts/zeus-*` and `.claude/` are now classified, at `product` radius,
   which closes the fail-open. But `product` means "user-visible product behaviour
   across packages", and that is not what these files are: they are the system every
   future turn runs on. A seventh level would describe them honestly, and would renumber
   a scale that `zeus-validate.mjs` requires to be contiguous from 0. That is a
   vocabulary decision, and re-pointing the seven path rules at a new level afterwards
   is a one-line change.
2. **Should `pnpm zeus:test` join them in CI?** The drift guards, `zeus:validate` and
   the guard regression suite now run there. The full system test does not, because it
   asserts a p95 compile time under 20 ms on a shared runner. Splitting the timing
   assertion out would let the rest of it run.
3. **How often should `/zeus-refine` be allowed to fire?** The gate is built to decline,
   and the three entries recorded here are a bootstrap. If it starts producing a
   proposal most sessions, the bar is wrong.

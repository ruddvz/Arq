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

| Command                                  | Result                                                                              | Pass |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | ---- |
| `pnpm test`                              | 355 files, 3993 tests passed (baseline 352 / 3907; +3 files, +86 tests, 0 failures) | yes  |
| `pnpm typecheck`                         | 37 tasks successful, 37 total                                                       | yes  |
| `pnpm lint`                              | `eslint .`, no output                                                               | yes  |
| `pnpm format:check`                      | All matched files use Prettier code style                                           | yes  |
| `pnpm build`                             | exit 0, 12.1s                                                                       | yes  |
| `pnpm zeus:test`                         | Zeus 5 full system tests passed                                                     | yes  |
| `node scripts/zeus-validate.mjs`         | 13 modules, 98 methods, 38 skills, 7 reviewer agents, 6 blast radius levels         | yes  |
| `node scripts/zeus-verify.mjs`           | passed (29 required files, was 23)                                                  | yes  |
| `node scripts/zeus-drift-guard.mjs`      | drift guards passed                                                                 | yes  |
| `node scripts/zeus-drift-guard-test.mjs` | 16 cases, each guard broken on purpose                                              | yes  |
| `node scripts/zeus-guard-test.mjs`       | 23 cases (unchanged)                                                                | yes  |

Pre-existing failures in files not touched: **zero, before and after.** The baseline was
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

`scripts/zeus-drift-guard-test.mjs` holds 16 cases; each breaks one guard in a throwaway
copy and asserts both the non-zero exit and the message. The two that matter most:

- **The bystander-string case.** The hook is edited to `cat` the harness script instead
  of running it, so the filename survives. Weakening `HARNESS_INVOCATION` to a filename
  match makes 2 of 16 cases fail, which is how the invocation match is proven to be the
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

## 6. What is NOT done

None of these is solved. Partial must never read as green.

1. **Independent review was not dispatched.** This session was explicitly forbidden from
   using the Agent tool, so no `arq-*-reviewer` cleared this work; the author's own
   critique is not a substitute. Zeus's own rule does not require review here (moderate
   risk, `package` blast radius), but the integration package's critique gate does, so
   this is a real gap and not a technicality. Dispatch
   `arq-security-ai-reviewer` (the routed module is `ai`) before merging.
2. **Every gate is self-attested.** Recording `typecheck --outcome pass` does not run
   `tsc`. The ledger records a claim about a check, not the check. Closing this needs a
   gate runner that executes the command itself, or CI that owns the ledger.
3. **No Zeus self-check runs in CI.** `pnpm zeus:test`, `pnpm zeus:validate` and
   `pnpm zeus:drift` are wired into no workflow, so the drift guards are enforced by
   convention. The 84 new tests are the exception: `vitest.config.ts` now collects
   `scripts/**/*.test.ts`, and `pnpm test` runs in `.github/workflows/ci.yml`. The
   ledger still cannot force itself to be run.
4. **The reviewer match is only as good as the impact map.** It is a real match check
   now, but a path no pattern covers produces `matched: false`, which falls back to
   "any dispatchable agent". That is fail-closed rather than fail-open, and it is
   weaker than a match.

Deliberately out of scope, per the integration package: a `ROLES.json`, a gate runner
that executes commands, and anything from prime-agent's runtime.

## 7. Open questions for the repository owner

1. **Zeus's own operating surface is unclassified, by both maps.** `.zeus/impact-map.json`
   has no pattern for `.zeus/`, `scripts/` or `.claude/`, and `.zeus/blast-radius.json`
   `pathRules` has no rule for them either. Measured on this very diff:
   `pnpm zeus:gate reviewers` returns `matched: false`, "changed paths match no module
   that names a reviewer", for a change that rewrites the always-on hook, and
   `node scripts/zeus-impact.mjs` classifies it as `local` from paths and `package`
   overall. A fault there degrades every future turn rather than one feature. Adding
   rules would raise the tier and name a reviewer for every Zeus edit, but none of the
   six blast radius levels is an obvious fit for "the agent operating system itself", so
   this is a vocabulary decision rather than a fix to make unilaterally. It is the
   single highest-value follow-up in this list.
2. **Should the drift guards run in CI?** Adding `pnpm zeus:drift` and
   `pnpm zeus:validate` to the `lint-and-typecheck` job would convert limit 3 from
   convention into enforcement. Both are deterministic, dependency-free and fast. The
   full `pnpm zeus:test` should NOT be added as it stands: it asserts a p95 compile time
   under 20ms, which is timing-sensitive on a shared runner.
3. **How often should `/zeus-refine` be allowed to fire?** The gate is built to decline,
   and the three entries recorded here are a bootstrap. If it starts producing a
   proposal most sessions, the bar is wrong.

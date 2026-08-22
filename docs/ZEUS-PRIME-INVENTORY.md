# Zeus x prime-agent integration: Phase 0 inventory

Read off disk on 2026-08-22 against the working tree of `ruddvz/arq`, branch
`claude/zeus-implementation-perfect-9au9az`. Every answer cites the file that
proves it. Nothing here is inferred from the integration package, which was
written by someone who had never seen this repository.

## 1. Where does Zeus doctrine live, and what is canonical?

| Layer                  | Path                                                                            | Role                                         |
| ---------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| Repository instruction | `CLAUDE.md`                                                                     | Tells every session to load the kernel first |
| Always-on core         | `.zeus/FAST-KERNEL.md` (4,871 B)                                                | The only file loaded by default              |
| Full specification     | `.zeus/ZEUS.md` (3,089 B) + 12 sibling documents (`.zeus/*.md`, 47,926 B total) | Opened on demand                             |
| Invariants             | `.zeus/INVARIANTS.md` (10,324 B)                                                | 85 numbered invariants, single home          |
| Domain modules         | `.zeus/modules/*.md` (13 files)                                                 | Routed by tier, applied per domain           |

`CLAUDE.md` states the canonical rule: "Before any actionable work ... load
`.zeus/FAST-KERNEL.md` first. Do not load the rest of `.zeus/` by default."
`.zeus/INVARIANTS.md` is the single home for the invariants and
`CLAUDE.md` forbids restating them elsewhere.

Authority above Zeus: `.zeus/config.json` `gate.authority` is `engineering-os-5`.
Zeus may raise a lane, never lower one, never stand in for
`.github/workflows/engineering-gate.yml`. Public and product wording is owned by
the Arq Language System (`docs/product/voice/`), not by Zeus.

## 2. Is there a UserPromptSubmit hook?

Yes. `.claude/settings.json` wires `UserPromptSubmit` to `bash scripts/zeus-hook.sh`.
The hook parses the prompt, skips automation payloads, single-word
acknowledgements and five `/zeus-*` slash commands, then runs
`node scripts/zeus-fast-compile.mjs --task "<prompt>"` and prints the compiled
compact contract.

Three further hooks are wired in the same file:

- `PreToolUse` on `Bash|Write|Edit|MultiEdit`: `.claude/hooks/pre-tool-guard.cjs`
- `PostToolUse` on `Write|Edit|MultiEdit`: `scripts/arq-language-guardian.mjs` and
  `.claude/hooks/post-write-invariant-guard.cjs`
- `Stop`: `.claude/hooks/stop-evidence-check.cjs`

No safety classifier blocked editing `.claude/settings.json` or
`scripts/zeus-hook.sh` in this session; `pre-tool-guard.cjs` protects real
SQLite `.arq` containers, secret paths and destructive commands, none of which
this work touches.

## 3. How are agents defined, and what makes one dispatchable?

`.claude/agents/*.md`, seven files: `arq-architecture-reviewer`,
`arq-file-integrity-reviewer`, `arq-geometry-reviewer`, `arq-release-reviewer`,
`arq-security-ai-reviewer`, `arq-ux-accessibility-reviewer`, `zeus-orchestrator`.

`scripts/zeus-validate.mjs` section 7 already pins the registration rule it
enforces: frontmatter must open with `name:` then `description:`, `name` must
equal the filename, and the body must reference `.zeus/INVARIANTS.md`. Claude
Code itself registers an agent on a non-empty `description:` in the leading
frontmatter block.

Critically for the gate ledger, this repository already has a
**changed-path to reviewer map**, which the integration package names as its
largest unclosed gap:

- `.zeus/impact-map.json` maps path globs to module ids
  (`packages/geometry-*/**` to `geometry`, `**/migrations/**` to `arqfs`+`security`, ...)
- `.zeus/module-manifest.json` maps each module id to its reviewer agents
  (`arqfs` to `arq-file-integrity-reviewer`, `ai` to `arq-security-ai-reviewer`, ...)
- `scripts/zeus-validate.mjs` already fails when a module names a reviewer that
  does not exist on disk.

## 4. Test runner, naming and location

`vitest`. `vitest.config.ts` includes exactly three patterns:
`packages/*/src/**/*.test.ts`, `apps/*/src/**/*.test.ts`,
`workers/*/src/**/*.test.ts`. Nothing under `scripts/` is collected today.

Zeus's own tooling is tested by plain-node scripts instead, run through
`pnpm zeus:test` (`scripts/test-zeus-system.sh`), which chains
`zeus-verify.mjs`, `test-zeus-hook.sh`, `zeus-validate.mjs`,
`zeus-classification-test.mjs` and `zeus-guard-test.mjs`.

**None of the Zeus self-checks run in CI.** `grep -rn zeus .github/workflows/`
returns nothing. `pnpm test` does run in CI (`.github/workflows/ci.yml`, job
`test`), so a vitest suite is the only way a new Zeus test is enforced rather
than merely available.

## 5. Verification commands and recorded baseline

Recorded before any file was changed:

| Command                            | Real result                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm test`                        | 352 test files, 3907 tests, all passed, 67.36s                                      |
| `pnpm typecheck`                   | 37 tasks successful, 37 total                                                       |
| `pnpm lint`                        | `eslint .` produced no output: 0 errors, 0 warnings                                 |
| `pnpm format:check`                | All matched files use Prettier code style                                           |
| `pnpm build`                       | exit 0, 12.1s                                                                       |
| `node scripts/zeus-validate.mjs`   | passed: 13 modules, 98 methods, 38 skills, 7 reviewer agents, 6 blast radius levels |
| `node scripts/zeus-verify.mjs`     | passed (23 required files)                                                          |
| `node scripts/zeus-guard-test.mjs` | passed (23 cases)                                                                   |
| `bash scripts/test-zeus-hook.sh`   | passed                                                                              |

`scripts/zeus-check.mjs` defines the repository gate set at standard and deep
tier: `format:check`, `lint`, `typecheck`, `test`, `build`. That is Zeus's own
answer to "what is unconditional", so the gate ledger reuses it rather than
inventing a second list.

`scripts/zeus-fingerprint.mjs` already computes a workspace fingerprint from
`git HEAD` + the diff + untracked files + lockfiles. The ledger reuses it; a
second notion of "has anything changed" would violate the reuse invariant.

## 6. Does Zeus record lessons, and does anything read them back?

`.zeus/eval-log.jsonl` exists and is **empty**. It is appended to by
`scripts/zeus-eval-record.mjs` and read only by `scripts/zeus-eval-stats.mjs`,
which prints aggregate counts by outcome and lane.

`grep -rln 'eval-log'` over the repository returns exactly those two scripts.
The hook does not read it, no skill reads it, no agent reads it. The schema
(`.zeus/eval-log.schema.json`) carries `verified` and `remaining` string arrays,
which are per-run outcomes, not durable lessons: there is no lesson field at all.

**So nothing Zeus learns reaches a later turn.** This is the exact failure the
continual harness exists to fix, present here in a stronger form than in the
reference repository, which at least had an `injected` lesson field.

## 7. Risk tiers, execution tiers and loop bounds

Two separate vocabularies, both in Zeus:

- **Risk**: `low | moderate | high | critical` (`scripts/lib/zeus-engine.mjs:113`).
  Note `moderate`, not the reference implementation's `medium`.
- **Execution tier**: `fast | standard | deep` (`.zeus/config.json` `budgets`).

Loop bounds are per **tier**, not per risk:
`.zeus/config.json` `budgets.fast.repairRounds = 2`, `standard = 3`, `deep = 5`.

Independent review is required by Zeus's own rule in
`scripts/lib/zeus-engine.mjs:515`: risk at `high` or above, **or** the blast
radius level sets `requiresReview`. `.zeus/blast-radius.json` sets that flag on
`product`, `persistent`, `public` and `production`, and leaves it false on
`local` and `package`.

## 8. File placement conventions

- Zeus executables: `scripts/zeus-*.mjs`, flat, 37 of them. Shared engine at
  `scripts/lib/zeus-engine.mjs`. No `scripts/zeus/` subdirectory exists.
- Zeus doctrine and state: `.zeus/`.
- Slash commands: `.claude/commands/zeus*.md` with `description:` frontmatter.
- Zeus-facing documents: `docs/ZEUS-*.md` (three already exist).
- **House style constraint:** `scripts/zeus-validate.mjs` section 10 fails on any
  U+2014 em dash inside `.zeus/`, `.claude/agents/`, `.claude/hooks/` and
  `.claude/skills/zeus*`. It skips directories named `cache`, `runs` and
  `backups`. Anything new written into `.zeus/` must respect this.
- **Formatting gate:** `pnpm format:check` runs Prettier over the whole tree in
  CI, so every new file must be Prettier-clean (`.prettierrc.json`: 100 columns,
  single quotes, trailing commas).
- **Language System:** `docs/product/voice/context-contract.json` lists 29
  governed source sets. None of them covers `.zeus/`, `scripts/`, `.claude/` or
  `docs/ZEUS-*.md`, so this work does not require `pnpm arq:language:refresh`.

## 9. Idea-by-idea map

| prime-agent idea          | State in Zeus                                                                                                                                                                                                                                                                                                      | Decision                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Continual harness      | **Absent.** `.zeus/eval-log.jsonl` is empty, has no lesson field, and is read only by a stats printer.                                                                                                                                                                                                             | Build.                                                                                                                                                                             |
| 2. Refine gate            | **Absent.** Six slash commands exist; none reviews a session for durable lessons.                                                                                                                                                                                                                                  | Build, on Zeus's command convention.                                                                                                                                               |
| 3. Progressive disclosure | **Already present.** `.zeus/FAST-KERNEL.md` is the always-on core, `CLAUDE.md` says not to load the rest of `.zeus/` by default, and modules are routed by tier under explicit context budgets.                                                                                                                    | **Do not rebuild.** Build only the missing half: the drift check that proves the kernel stays a faithful subset. `zeus-validate.mjs` section 11 checks four literal strings today. |
| 4. Gate ledger            | **Partly present.** `scripts/zeus-evidence.mjs` records typed claims per run and refuses green on any non-verified state. It has no workspace fingerprint, no staleness, no round bound, no unconditional floor and no review requirement. `scripts/zeus-fingerprint.mjs` exists but nothing binds evidence to it. | Build the gate layer on top; reuse the fingerprint, the tier bounds, and the impact-to-reviewer map. Do not add a second evidence ledger.                                          |

## 10. Where this build can beat the reference implementation

The package discloses three known limits. Two are inherited unchanged; one is
closable here because Arq already has the data:

1. _"The reviewer check is a name check, not a match check. The fix is a
   path-glob-to-reviewer map; it was not built."_ Arq has that map already, in
   two files that `zeus-validate.mjs` already keeps honest
   (`.zeus/impact-map.json` and `.zeus/module-manifest.json`). The ledger can
   require a reviewer that the changed paths actually call for, not merely a
   reviewer that exists.
2. _Self-attested gates._ Inherited. Recording `typecheck --outcome pass` still
   does not run `tsc`.
3. _The ledger cannot force itself to be run._ Inherited, and worse here: no
   Zeus check runs in CI at all today.

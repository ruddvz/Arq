# Arq — Claude Code instructions

**Zeus 5.0 is active for this repository.** Before any actionable work — a fix, a
feature, a review, a GitHub action — load `.zeus/FAST-KERNEL.md` first. Do not load
the rest of `.zeus/` by default.

1. Classify the task on four axes: mode, risk, blast radius and reversibility. Tier
   (fast / standard / deep) follows from them, and blast radius or reversibility may
   raise it. Route only the modules under `.zeus/modules/` that the tier allows. Check
   with `node scripts/zeus.mjs compile --task "..."` if uncertain.
2. Use the project index (`node scripts/zeus.mjs context --query "..."`) for ranked
   evidence instead of reading the whole repository.
3. Execute the smallest complete slice to the requested delivery stop, and do not pass
   it. A `local-green` task does not open a pull request.
4. Run the adaptive check ladder for that tier (`node scripts/zeus.mjs check --tier
<tier>`); never accept cached evidence for security, `.arq`, migration, recovery,
   release, CI, deployment, production or incident work.
5. Report each claim with its evidence state: verified, partially-verified, inferred,
   assumed, blocked, not-inspected or failed. Only verified is green. Record claims
   with `node scripts/zeus.mjs evidence` when the run is standard or deep.

The 85 Arq invariants live in one place, `.zeus/INVARIANTS.md`. Modules apply them to a
domain and the reviewer agents in `.claude/agents/` verify against them. Do not restate
them elsewhere.

A `UserPromptSubmit` hook (`.claude/settings.json` → `scripts/zeus-hook.sh`) compiles and
echoes back the actual Zeus contract for every actionable prompt — mode, risk, tier,
blast radius, reversibility, delivery stop, owner, reviewers, routed modules, method
stack, acceptance criteria and checks — so what Zeus decided is always visible, not
silent. It stays quiet only on acknowledgements, `/zeus-*` slash commands (which already
carry their own contract), and automation/webhook payloads.

Two deterministic guards run alongside it: `.claude/hooks/pre-tool-guard.cjs` blocks
destructive commands, secret access and edits to real project containers (ArqScript
`.arq` sources and fixtures stay editable), and `.claude/hooks/stop-evidence-check.cjs`
blocks a completion claim made with no tool evidence at all. Both are pinned by
`node scripts/zeus-guard-test.mjs`.

Four records keep "verified" and "finished" facts rather than memories, and all are
additive to the five steps above rather than a replacement for them. They answer four
different questions: what each claim rests on (`zeus evidence`), which checks passed and
at which tree (`zeus:gate`), where the work sits in the delivery pipeline
(`zeus state`), and what the work items are and which are proven (`zeus:plan`).

- **Plan ledger** (`pnpm zeus:plan`): every item names an owning role from
  `.zeus/role-registry.json` and its own acceptance; an item is done only with a command
  and a zero exit; and `close` refuses while any item is pending, active or blocked,
  naming each one. That refusal is the loop, and it is what stops a six-item request
  being reported finished after four.

- **Gate ledger** (`pnpm zeus:gate`): a gate result belongs to the workspace fingerprint
  it was recorded at, so any edit makes it stale; a failed gate is never skippable;
  rounds are bounded by the tier repair budget in `.zeus/config.json`; and `ship` refuses
  until every gate in `gates.repositoryGates` passed at the current fingerprint and,
  where risk or blast radius requires review, a `review:<agent>` gate passed naming an
  agent that exists in `.claude/agents/` and that the changed paths actually call for
  (`.zeus/impact-map.json` to `.zeus/module-manifest.json`). It records a claim about a
  check, not the check itself.
- **Continual harness** (`pnpm zeus:harness`, proposed by `/zeus-refine`): supplemental
  learned state, injected into every turn by the hook within a character budget. Evidence
  is mandatory on every entry and every mutation is one rollback away. It is supplemental
  only: it never edits this file, `AGENTS.md` or anything under `.zeus/`, and doctrine
  wins on any conflict with an entry.

`pnpm zeus:drift` proves the kernel still carries every mode, tier, blast radius level,
reversibility, evidence state and configured budget, that the hook still injects learned
state, and that the published saving is still true.

Full specification: `.zeus/ZEUS.md`. What changed from Zeus 4: `.zeus/UPGRADE-4-TO-5.md`.
Slash commands: `/zeus`, `/zeus-audit`, `/zeus-handoff`, `/zeus-design`,
`/zeus-incident`, `/zeus-release`, `/zeus-refine`.

**Zeus is advisory, not merge authority.** Deterministic change classification,
evidence selection, and approval gating belong to Engineering OS 5.0
(`engineering/`, enforced by `.github/workflows/engineering-gate.yml`). Zeus may
add context and propose escalations; it may never lower a lane, mark missing
evidence as passed, or stand in for the gate — see
`engineering/30_ZEUS_AND_ENGINEERING_AUTHORITY.md`.

## Z Voice (Arq Language System 4.1)

The governed vocabulary lives under `docs/product/voice/` and is enforced by the
`language-system` CI job and the Pages deployment gates. The Language System, not Zeus,
owns public and product wording: Zeus reports a wording defect and never re-decides the
vocabulary. Standing rules for every session, human or AI:

1. Any change that touches a governed source set (the 29 sets listed in
   `docs/product/voice/context-contract.json`: STATUS.md, README.md, ADRs,
   marketing content, workspace registries, state machines, routes, RBAC and
   the rest) must run `pnpm arq:language:refresh` once, in the same change.
   The refresh appends an entry to `docs/product/voice/context/REFRESH-LOG.json`
   naming the source sets that moved; CI fails a context whose change is not
   logged, and never regenerates the context itself.
2. All copy that AI writes for product UI, marketing pages or docs is checked
   at write time by the warn-only guardian hook
   (`scripts/arq-language-guardian.mjs`, wired as a `PostToolUse` hook) and
   blocked at CI time by `pnpm arq:language:audit:ci`. Do not bypass a guardian
   warning; fix the wording or record a reviewed acknowledgement.
   `.claude/hooks/post-write-invariant-guard.cjs` runs beside it and covers only the
   product-safety absolutes the Language System does not already carry, on files
   outside the guardian's scope, so the two never double-report.
3. Before pushing a change that affects public copy, product state language or
   the registries, run the ladder: `pnpm arq:language:sources:verify` through
   `pnpm arq:language:audit:ci` (order in
   `docs/product/voice/INTEGRATION-BRIEF.md`), then tests.
4. A public current-state claim needs a claim-registry binding; an open
   conflict in `docs/product/voice/conflict-registry.json` blocks its claims
   from every surface until resolved by its owner.

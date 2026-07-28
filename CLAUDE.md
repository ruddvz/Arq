# Arq — Claude Code instructions

**Zeus 4.0 is active for this repository.** Before any actionable work — a fix, a
feature, a review, a GitHub action — load `.zeus/FAST-KERNEL.md` first. Do not load
the rest of `.zeus/` by default.

1. Classify the task's tier (fast / standard / deep) and route only the modules under
   `.zeus/modules/` that tier allows. Use `node scripts/zeus.mjs route --task "..."` to
   check routing if uncertain.
2. Use the project index (`node scripts/zeus.mjs context --query "..."`) for ranked
   evidence instead of reading the whole repository.
3. Execute the smallest complete slice to the requested delivery stop.
4. Run the adaptive check ladder for that tier (`node scripts/zeus.mjs check --tier
<tier>`); never accept cached evidence for security, `.arq`, migration, recovery,
   release, CI, deployment, production or incident work.
5. Report real, verified status only: green, partial, blocked or failed.

A `UserPromptSubmit` hook (`.claude/settings.json` → `scripts/zeus-hook.sh`) compiles and
echoes back the actual Zeus contract for every actionable prompt — mode, risk, tier,
delivery stop, owner/reviewers, routed modules, acceptance criteria and checks (via
`node scripts/zeus-fast-compile.mjs --task "..."`) — so what Zeus decided is always
visible, not silent. It stays quiet only on acknowledgements, `/zeus-*` slash commands
(which already carry their own contract), and automation/webhook payloads.

Full specification: `.zeus/ZEUS.md`. Domain rules: `.zeus/modules/`. Slash commands:
`/zeus`, `/zeus-audit`, `/zeus-handoff`, `/zeus-design`, `/zeus-incident`,
`/zeus-release`.

## Z Voice (Arq Language System 4.1)

The governed vocabulary lives under `docs/product/voice/` and is enforced by the
`language-system` CI job and the Pages deployment gates. Standing rules for
every session, human or AI:

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
3. Before pushing a change that affects public copy, product state language or
   the registries, run the ladder: `pnpm arq:language:sources:verify` through
   `pnpm arq:language:audit:ci` (order in
   `docs/product/voice/INTEGRATION-BRIEF.md`), then tests.
4. A public current-state claim needs a claim-registry binding; an open
   conflict in `docs/product/voice/conflict-registry.json` blocks its claims
   from every surface until resolved by its owner.

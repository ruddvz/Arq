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

A `UserPromptSubmit` hook (`.claude/settings.json` → `scripts/zeus-hook.sh`) reinforces
this on every actionable prompt; it stays silent on acknowledgements, `/zeus-*` slash
commands (which already carry their own contract), and automation/webhook payloads.

Full specification: `.zeus/ZEUS.md`. Domain rules: `.zeus/modules/`. Slash commands:
`/zeus`, `/zeus-audit`, `/zeus-handoff`, `/zeus-design`, `/zeus-incident`,
`/zeus-release`.

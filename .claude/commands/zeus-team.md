---
description: Run one task through the full senior role chain autonomously
---

Read `.zeus/FAST-KERNEL.md` and `company/ZEUS-BRIDGE.md`. Then run the task below
through the complete role chain, end to end, without waiting to be asked between
stages:

1. **Contract.** Compile and show the contract and execution prompt
   (`node scripts/zeus.mjs prompt --task "..." --with-contract`). The fronting company
   role comes from `node scripts/zeus.mjs roles --task "..."`.
2. **Sponsor brief.** As the fronting executive or lead role (`company/roles/`), state
   outcome, delivery stop and non-goals in at most five lines. No reclassifying.
3. **Plan.** As the accountable owner, establish current state from ranked evidence
   (`node scripts/zeus.mjs context --query "..."`) and plan the smallest complete
   slice.
4. **Implement** to the delivery stop and not past it. Any prompt written for a
   subagent is shown in full in a fenced code block and passes
   `node scripts/zeus.mjs prompt-lint` before dispatch.
5. **Verify.** Run the tier's ladder (`node scripts/zeus.mjs check --tier <tier>`);
   record claims with `node scripts/zeus.mjs evidence` on standard and deep runs.
6. **Independent review.** Dispatch the reviewer agents the contract names; the author
   never clears their own work. Repair findings within the tier's repair budget,
   re-reviewing against current head.
7. **Handoff.** Report exactly one final state (green, partial, blocked, failed,
   rolled_back), each claim with its evidence state, and what was not inspected.

Escalate to the operator only for irreversible steps, authority the gates refuse, or a
genuine scope fork. Task:

$ARGUMENTS

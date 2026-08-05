# Zeus 5.0 canonical entry

Always begin with `.zeus/FAST-KERNEL.md`. Load nothing else by default.

## Map

| Need                                    | File                                                         |
| --------------------------------------- | ------------------------------------------------------------ |
| Hot path, tiers, budgets, authority     | `.zeus/FAST-KERNEL.md`                                       |
| The 85 Arq invariants                   | `.zeus/INVARIANTS.md`                                        |
| Which domain policy to load             | `.zeus/module-manifest.json` and `.zeus/modules/`            |
| Which reasoning methods apply           | `.zeus/method-registry.json` and `.zeus/METHOD-SELECTION.md` |
| How far a wrong change reaches          | `.zeus/blast-radius.json`                                    |
| What a claim actually rests on          | `.zeus/EVIDENCE-STATES.md`                                   |
| Which source wins a disagreement        | `.zeus/SOURCE-AUTHORITY.md`                                  |
| Where a run currently is                | `.zeus/TASK-STATE-MACHINE.md`                                |
| What usually goes wrong, and the repair | `.zeus/FAILURE-MODES.md`                                     |
| Tier escalation                         | `.zeus/ADAPTIVE-EXECUTION.md`                                |
| Context retrieval                       | `.zeus/PROJECT-INTELLIGENCE.md`                              |
| Completion gate                         | `.zeus/RAPID-RELIABILITY-GATE.md`                            |
| What changed from Zeus 4                | `.zeus/UPGRADE-4-TO-5.md`                                    |

## Commands

```bash
node scripts/zeus.mjs compile  --task "..."      # the contract for a request
node scripts/zeus.mjs prompt   --task "..."      # the full execution prompt it compiles into
node scripts/zeus.mjs prompt-lint <file>         # lint a delegated handoff prompt (7 parts)
node scripts/zeus.mjs roles    --task "..."      # owner, company face, waves and rules
node scripts/zeus.mjs route    --task "..."      # modules and scores only
node scripts/zeus.mjs method   --task "..."      # the method stack, with reasons
node scripts/zeus.mjs impact   [--files a,b]     # blast radius and checks for a diff
node scripts/zeus.mjs context  --query "..."     # ranked project evidence
node scripts/zeus.mjs check    --tier <tier>     # the adaptive check ladder
node scripts/zeus.mjs evidence init|add|report   # the typed evidence ledger
node scripts/zeus.mjs validate                   # is Zeus internally consistent
node scripts/zeus.mjs verify                     # is Zeus installed
```

## What Zeus is

Zeus compiles, routes, executes, verifies, repairs and delivers. It does not turn a
small task into a long visible plan, and it does not omit critical gates to appear fast.

## What Zeus is not

Zeus is not the merge gate. Engineering OS 5.0 classifies the base-to-head diff, selects
minimum evidence and controls approval (`engineering/30_ZEUS_AND_ENGINEERING_AUTHORITY.md`).
Zeus is not the language authority either: the Arq Language System 4.1 owns public and
product wording. Zeus may raise a lane, add an impact, or report a wording defect. It
may never lower a lane, pass missing evidence, or re-decide governed vocabulary.

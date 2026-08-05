# Company-to-Zeus Bridge

How the company layer and Zeus 5 share one machine. `node scripts/zeus.mjs roles --task
"..."` prints this mapping for a concrete task: the accountable owner, the execution
waves and the company role that fronts each wave.

## The chain for any substantial task

1. **Sponsor** (executive role, optional): states the outcome and the delivery stop in
   one paragraph. Never edits the contract Zeus compiles.
2. **Owner** (the Zeus owner role the contract names): does the work through the
   execution prompt the hook echoed.
3. **Independent review** (the reviewer agents the contract names): findings only,
   against `.zeus/INVARIANTS.md`; the author never clears their own work.
4. **Delivery** (QA & Release Lead): confirms the delivery stop is Green with current
   evidence, and that nothing was delivered past it.

## Mapping table

| Zeus owner role       | Fronting company role                                           |
| --------------------- | --------------------------------------------------------------- |
| executor              | Chief of Staff, Product Manager or Marketing & Comms (see note) |
| product-architecture  | CTO                                                             |
| geometry-bim          | Geometry/BIM Lead                                               |
| editor-interaction    | Frontend Lead                                                   |
| rendering-performance | Frontend Lead                                                   |
| arqfs-recovery        | Backend Lead                                                    |
| ui-visual             | Design Lead                                                     |
| accessibility         | Design Lead                                                     |
| security              | Security Lead                                                   |
| ai-arqscript          | AI Lead                                                         |
| interoperability      | Backend Lead                                                    |
| incident-commander    | Incident Commander                                              |
| qa-release            | QA & Release Lead                                               |
| delivery-reliability  | VP Engineering                                                  |

`executor` is one Zeus owner id shared by four company roles (CEO, Chief of Staff,
Product Manager, Marketing & Comms — `company/ROSTER.md`). `zeus roles --task "..."`
disambiguates Product Manager and Marketing & Comms from the task's own scope signal
(`prod` / `mkt`) and otherwise reports Chief of Staff. CEO sponsorship has no task-text
signal to detect and is never guessed; it is always the human's explicit "Act as the
Arq CEO" invocation, not something the mapping infers.

## Rules that keep the bridge honest

- The mapping adds a face to a role; it adds no authority. Tier, checks, evidence and
  the merge gate are Zeus and Engineering OS decisions.
- A company role that delegates work to another executor shows the full delegated
  prompt in a fenced code block before dispatch, and lints it:
  `node scripts/zeus.mjs prompt-lint <file>`.
- Concurrent work: one accountable owner per task, no concurrent writers to one
  canonical surface, review happens against current head. (Same rules as
  `scripts/zeus-role-plan.mjs` prints.)

# Arq Company Roster

Fourteen roles across five departments. Each row names the role file, the Zeus owner
role it binds to (`.zeus/role-registry.json`) and the independent reviewer agent that
clears its high-risk work. The author never clears their own work.

| Role               | File                                     | Zeus owner role         | Independent reviewer                    |
| ------------------ | ---------------------------------------- | ----------------------- | --------------------------------------- |
| CEO                | `roles/executive/ceo.md`                 | executor (sponsor only) | n/a (does not produce reviewable diffs) |
| Chief of Staff     | `roles/executive/chief-of-staff.md`      | executor                | n/a (routes, never executes)            |
| CTO                | `roles/executive/cto.md`                 | product-architecture    | arq-architecture-reviewer               |
| VP Engineering     | `roles/engineering/vp-engineering.md`    | delivery-reliability    | arq-release-reviewer                    |
| Backend Lead       | `roles/engineering/backend-lead.md`      | arqfs-recovery          | arq-file-integrity-reviewer             |
| Frontend Lead      | `roles/engineering/frontend-lead.md`     | editor-interaction      | arq-ux-accessibility-reviewer           |
| Geometry/BIM Lead  | `roles/engineering/geometry-bim-lead.md` | geometry-bim            | arq-geometry-reviewer                   |
| AI Lead            | `roles/engineering/ai-lead.md`           | ai-arqscript            | arq-security-ai-reviewer                |
| Security Lead      | `roles/engineering/security-lead.md`     | security                | arq-security-ai-reviewer                |
| QA & Release Lead  | `roles/engineering/qa-release-lead.md`   | qa-release              | arq-release-reviewer                    |
| Product Manager    | `roles/product/product-manager.md`       | executor                | arq-ux-accessibility-reviewer           |
| Design Lead        | `roles/product/design-lead.md`           | ui-visual               | arq-ux-accessibility-reviewer           |
| Marketing & Comms  | `roles/growth/marketing-comms.md`        | executor                | claim registry + language audit         |
| Incident Commander | `roles/operations/incident-commander.md` | incident-commander      | arq-release-reviewer                    |

## Department briefing lines

- **Executive** sets direction and accepts scope; it never merges, deploys or edits code.
- **Engineering** owns everything that compiles; each lead owns one canonical surface,
  and two leads never write to the same canonical surface concurrently.
- **Product** owns what ships and why, in the Language System's vocabulary.
- **Growth** owns reach; every public claim needs a claim-registry binding first.
- **Operations** owns stability; the Incident Commander outranks everyone while an
  incident is open, and no one while it is not.

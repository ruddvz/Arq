# Arq repository and live-site audit

Observed repository:

- Repository: ruddvz/Arq
- Default branch: claude/arq-cad-platform-research-ba8rav
- Audited commit: e1aa1018b0ba8c3c3f9cd64bb34edb38db7e220d
- Commit subject: Full-repo audit and completion: website, canvas, validation,
  persistence, 3D, quality gates, Pages deploy
- Public site: https://ruddvz.github.io/Arq/

## Current technical surface

| Surface                     | Evidence                                                      | Exposure state                                                 |
| --------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| Workspace shell             | apps/web, packages/workspace, design-system                   | current demo surface                                           |
| Plan drawing                | PlanCanvas, canvas interaction, validation, operation journal | current demo surface                                           |
| Local journal               | apps/web plan-journal over packages/local-storage IndexedDB   | current demo surface, not project-file save                    |
| Native .arq format          | packages/arqfs and arqfs worker                               | library and worker capability, open-project pipeline not wired |
| File-open UI                | FileOpenPanel and file-flow state                             | byte safety and compatibility verdict, not project opening     |
| 3D model canvas             | ModelCanvas, model-renderer, geometry-3d                      | current demo surface, contradicted by STATUS.md                |
| Import and export           | adapters and import-export worker                             | library capability, no end-to-end UI path                      |
| Sync and accounts           | apps/api stub and protocol groundwork                         | inactive product capability                                    |
| Marketing site              | apps/marketing static build, 17 public routes plus 404        | deployed Pages surface                                         |
| Existing engineering helper | .zeus and scripts/zeus-*                                      | local advisory system, not CI merge authority                  |

## Current workflow findings

1. CI performs format, lint, typecheck, tests, browser capability checks,
   dependency licence scan, and Rust checks. This is a solid baseline.
2. CI push filtering names main, but the repository default branch is
   claude/arq-cad-platform-research-ba8rav. Reconcile branch policy before
   treating post-merge CI as protected-default evidence.
3. GitHub Pages builds apps/marketing/dist but does not verify every rendered
   route, write a commit-bound proof, or verify live output after deploy.
4. Pages path filters omit some public-claim sources and governance sources.
5. CODEOWNERS contains @REPLACE placeholders, so code-owner enforcement is not
   meaningful yet.
6. Existing Zeus scripts use task-language routing and uncommitted-worktree
   files. They do not classify a merge-base pull-request diff or run as a
   required CI status.

## Public-site findings

All 17 public routes plus the 404 page rendered successfully in the live
browser audit. The visible U+2014 em dash count was:

| Route              | Visible count |
| ------------------ | ------------: |
| /                  |             4 |
| /product           |             7 |
| /architects        |            10 |
| /students          |             5 |
| /collaboration     |             3 |
| /ai                |             7 |
| /interoperability  |             3 |
| /ipad              |             4 |
| /pricing           |             4 |
| /security          |             5 |
| /docs              |             3 |
| /changelog         |            10 |
| /status            |             2 |
| /contact           |             4 |
| /legal/privacy     |             3 |
| /legal/terms       |             3 |
| /legal/open-source |             3 |
| /404               |             4 |
| Total              |            84 |

The U+2014 requirement belongs to the language system, but the engineering
system must verify rendered and deployed output rather than source alone.

## Public truth risks

- The home page describes doors, windows, rooms, and a local file as current
  user behaviour even though the current app wires only drawn walls and an
  IndexedDB journal.
- The product page describes a hardened .arq path and several release features
  beyond the user-reachable workflow.
- Security and status copy make broad no-account, no-server, and availability
  claims that need a current evidence owner.
- Pricing copy promises continued archive access without an approved
  commercial or entitlement contract.
- The 3D claim conflicts with a later STATUS.md statement that says the 3D
  stack has zero consumers.

5.0 does not rewrite these claims itself. It provides the exact release and
language controls that stop them from being silently approved.

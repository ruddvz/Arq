# Repository and editorial evidence used for Arq Language System 4.1

Inspected from the connected GitHub repository `ruddvz/Arq` on 27 July 2026.

## Product and architecture

- `README.md`
  - product thesis and protected workflow;
  - semantic/local-first/explainable principles;
  - `.arq` SQLite direction;
  - documentation precedence;
  - brand rules;
  - AI and professional-use boundaries.
- `STATUS.md`
  - implementation summary and known gaps;
  - current `.arq` library reachability;
  - workspace/plan/journal/3D claims;
  - no hosted sync backend;
  - an internal contradiction in current 3D status, retained as a conflict instead of silently resolved.
- `docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md`
  - target users, release ladder, anti-goals, workspace modes, visual/interaction system, semantic model and geometry rules.
- `docs/product/RELEASE-SCOPE.md`
  - Release 1 to 4 and explicitly deferred work.
- `docs/product/PRODUCT-COPY-PRINCIPLES.md`
  - current repo copy principles and five-part error structure.

## Interface registries

- `packages/workspace/src/workspace-types.ts`
  - workspace modes, view kinds, local-save and sync types, project-open states.
- `packages/workspace/src/registry/workspace-tool-registry.json`
  - 54 canonical tool names and design/implementation coverage status.
- `packages/workspace/src/registry/workspace-tab-registry.json`
  - 12 canonical view/tab kinds and behaviours.
- `packages/workspace/src/registry/workspace-panel-registry.json`
  - Project Browser, Inspector, Review rail, Task tray, AI proposal and Diagnostics.
- `packages/workspace/src/registry/workspace-keyboard-map.json`
  - canonical command labels and platform shortcut rules.
- `packages/workspace/src/registry/workspace-state-machines.json`
  - workspace, tab, tool, panel, save, sync, selection, issue, AI-proposal and long-task states.
- `packages/workspace/src/registry/workspace-capability-gates.json`
  - current, derived, gated and decision-required capability boundaries.
- `packages/workspace/src/registry/workspace-surface-registry.json`
  - 30 workspace surfaces and required state families.
- `docs/pages/ROUTE-MAP.csv`
  - 57 public, authentication, app and project surfaces.

## Files and recovery

- `packages/arqfs/src/arqfs-open.ts`
  - read/write/migrate capability distinctions.
- `packages/arqfs/src/arqfs-recovery-report.ts`
  - recovery facts separate from decisions.
- `packages/arqfs/src/arqfs-safe-mode.ts`
  - unreadable, corrupt, interrupted-write, reader-too-old-to-write, missing-required-entries, safe-mode-required and healthy plan kinds.
- `apps/web/src/file-handling/file-state-machine.ts`
- `apps/web/src/file-handling/describe-file-flow-state.ts`
- `apps/web/src/file-handling/FileOpenPanel.tsx`
  - current honest UI boundary: compatibility can be established before a live browser project-opening pipeline exists.

## Permissions, telemetry, AI and interoperability

- `security/RBAC-MATRIX.csv`
  - Owner, Administrator, Editor, Commenter and Viewer action permissions.
- `analytics/EVENT-DICTIONARY.csv`
  - approved coarse event properties and prohibition on raw project content.
- `docs/ai/AI-GUARDRAILS.md`
  - no hidden mutation, permission bypass, professional approval or application with blocking validation.
- `docs/interoperability/FORMAT-SUPPORT-MATRIX.md`
  - `.arq`, image/PDF, DXF, IFC, later formats and uncommitted DWG/RVT.
- `business/LAUNCH-CLAIMS-CHECKLIST.md`
  - unsupported high-risk public claims.

## Current implementation/copy evidence

- `apps/web/src/App.tsx`
  - current local journal labels, save state, demo/fixture honesty, commands and selection behaviour.
- `packages/validation/src/wall-segment-validation.ts`
  - implemented stable error codes and five-part plain-language validation contract.
- `apps/marketing/src/content/*.ts`
  - current public voice and claim wording.
- `apps/marketing/src/pages.test.ts`
  - rendered route, accessibility and launch-claim tests.
- `apps/marketing/src/routes.ts`
  - typed mapping from the eighteen content modules to the seventeen public
    routes plus the 404 page.
- `apps/marketing/src/build.ts`
  - deterministic static output layout and GitHub Pages base-path handling.
- `.github/workflows/deploy-pages.yml`
  - current GitHub Pages artifact and deployment path.
- `apps/marketing/src/content/contact.ts`
  - current support/security contact route for pre-release.

## Package limitation

The repository was inspected through the connected GitHub integration. The full repo could not be cloned into the execution container because the container does not have general outbound network resolution.

Therefore this package contains dated evidence snapshots plus scripts that must be installed into a real checkout to:

1. hash live canonical sources;
2. expose live registries to language/support/AI consumers;
3. fail when generated context is stale;
4. run the complete language audit beside the normal repository gates.

## Editorial and live-site evidence added in 4.0 and 4.1

- Wikipedia, ["Signs of AI writing"](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), accessed 27 July 2026.
  - supplied as `Google.pdf` for this review;
  - treated as descriptive editorial guidance, not a product-fact authority;
  - used to design evidence, specificity and human-review controls;
  - not used to infer authorship or to optimise copy for an AI detector.
- GitHub Pages, [Arq live site](https://ruddvz.github.io/Arq/), checked 27 July 2026.
  - all 17 public routes were opened from `ROUTE-MAP.csv`;
  - 46 U+2014 occurrences were found across 16 routes;
  - the dated route-by-route result is recorded in
    `00-audit/github-pages-live-audit-2026-07-27.json`.

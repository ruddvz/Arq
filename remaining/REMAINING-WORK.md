# Work still required

What is still required after reconciliation with upstream revision `7f15889`
and the candidate changes on 2026-08-04. Engineering state lives in `STATUS.md`; this file keeps only work
that still needs product integration, an owner decision, hardware, legal
advice, release evidence or market evidence. Completed planning-pack items are
removed instead of being left to misdescribe the repository as specification
only.

## Owner and legal

- Reconcile the public GitHub repository with `LICENSE`, which describes the
  contents as proprietary and confidential, and with
  `LICENSE-DECISION-REQUIRED.md`, which records a private-repository decision.
- Confirm the commercial and source-distribution strategy with legal advice.
- Complete trademark, domain and app-store name clearance.
- Obtain legal review for LGPL, MPL, GPL, AGPL, datasets and model weights.
- Obtain lawyer-approved privacy notice and product terms (the site's
  `/legal/*` pages publish current factual practice until then).
- Decide external-contributor and contributor-licence policy.

## User evidence

- Recruit and interview architects (guides exist in `docs/research/`).
- Validate the first paying audience and the first workflow.
- Test the desktop and iPad builds with real users.
- Confirm keyboard and command preferences.
- Confirm which exchange formats matter first.
- Run the pricing research plan (`business/PRICING-RESEARCH-PLAN.md`).

## Design

- Create the final product logo variants pending name clearance
  (brand kit exists in `brand/` under the working name).
- Draw the remaining technical icons (40 of 215 exist).
- Conduct an external accessibility review.

## Engineering integration and release evidence

- Review and accept, revise, or reject Proposed ADR-0028 for the
  SQLite-WASM/OPFS and Dexie/IndexedDB persistence responsibility split. The
  portable `.arq` working copy and the demo local journal must remain separate
  until an accepted decision exists.
- Wire the open-project pipeline: selected bytes, safe staging, copy-on-write
  migration, OPFS worker session, semantic-model hydration, workspace state,
  failure rollback and recovery evidence.
- Connect import/export adapters end to end with import reports.
- Build the product host and Review Centre surface for `@arq/mcp-server`, then
  record a real Claude Code, Codex or Cursor client run. The current package is
  library-complete but not product-reachable.
- Implement the sync transport/backend. `apps/api` remains a stub.
- Complete the protected wall/opening/room/dimension/sheet/vector-PDF/reopen
  workflow and its invalid-operation, recovery and rollback paths.
- Move Engineering OS 5.0 from shadow mode only after the missing
  `e2e_arq_open` evidence and protected L4 approval are real.
- Split the 1.14 MB pre-gzip `apps/web` main JavaScript chunk and add a
  reviewed bundle budget. The current build warns but does not fail.
- Close or rebuild open draft PR #280. Its old base, duplicate ADR-0027,
  and conflicting D-024 assignment make it unsafe to merge as written.

## Hardware-dependent work

- iPad Pencil hover and squeeze on supported hardware.
- Haptic snapping.
- RoomPlan and LiDAR accuracy and correction.
- Native file handling.
- Minimum supported devices.

## Business and operations

- Hosting provider and regions; data retention; backups.
- Incident response and support model.
- Pricing and billing.
- Launch market.
- Public claims and compatibility matrix sign-off before launch.
- Name the release owner and complete rollback and post-deployment runbooks.

The machine-readable register is `remaining/DECISIONS-REQUIRING-EVIDENCE.csv`.

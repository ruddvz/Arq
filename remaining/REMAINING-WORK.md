# Work still required

What cannot be completed honestly from inside this repository. Engineering
state lives in `STATUS.md`; this file lists the work that needs people,
hardware, legal advice or market evidence. Items completed since the
original planning pack (monorepo, packages, CI, fixtures, benchmarks and a
large share of the ordered issues) have been removed rather than left to
misdescribe the repository as a spec-only archive.

## Owner and legal

- Choose public or private repository visibility (repository exists).
- Select the source licence and commercial strategy
  (`LICENSE-DECISION-REQUIRED.md`).
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

## Engineering integration (tracked in backlog, needs build time not evidence)

- Wire the open-project pipeline: file-open → arqfs OPFS worker → workspace.
- Resolve the SQLite-WASM vs Dexie persistence overlap (see `STATUS.md`).
- Connect import/export adapters end to end with import reports.
- Implement `@arq/validation` and the sync transport/backend.
- Make the lint gate real and replace the echo template workflows.

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

The machine-readable register is `remaining/DECISIONS-REQUIRING-EVIDENCE.csv`.

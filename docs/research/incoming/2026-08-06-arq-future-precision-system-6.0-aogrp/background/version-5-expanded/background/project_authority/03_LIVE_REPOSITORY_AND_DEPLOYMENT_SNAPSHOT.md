---
source_id: ARQ-OS3-LIVE-SNAPSHOT
source_type: connected-system-evidence
class: A
status: observed-not-continuously-current
version: 2026-08-04.1
effective_date: 2026-08-04
owner: ARQ engineering owner
machine_record: 03_LIVE_REPOSITORY_AND_DEPLOYMENT_SNAPSHOT.md
---

# Live repository and deployment snapshot

This file records observations made on 4 August 2026. It is not a permanent source of current truth. Refresh it after its expiry or before a consequential decision.

## GitHub

- Repository: `ruddvz/Arq`
- Visibility observed: public
- Default branch observed: `claude/arq-cad-platform-research-ba8rav`
- HEAD observed: `7f15889ea66b672bd918a8b7ba61a904f6b4da3d`
- Latest observed merged work at that HEAD: MCP System 3.0, with ZEUS 5.0, Engineering OS 5.0, and Language System 4.1 already present in preceding commits.
- Connector capability observed: admin, maintain, push, pull, and triage. This is not user consent to write.
- Open pull request observed: draft PR 280.

## Critical conflict

Merged HEAD uses ADR-0027 for the MCP boundary. Draft PR 280 proposes a different ADR-0027 for desktop-shell deferral. This is an identifier collision. The accepted merged ADR must not be silently renumbered. The open PR must rebase and receive the next valid ADR ID, or be closed if superseded.

## Repository drift

`STATUS.md` was last updated 27 July 2026 and states that the ADR set ends at 0026. HEAD on 2 August includes ADR-0027 and later implementation evidence. The status source is stale and should be refreshed in the same governed change as any correction to public or product claims.

The default branch name is a temporary-looking Claude branch. It may be intentional, but it is a governance smell for production integration. A stable integration branch and explicit ruleset should be accepted before treating branch naming as permanent policy.

## Vercel

- Team ID observed: `team_nU2LivMue9dUZ751t9rq6OHW`
- Project: `arq-website`
- Project ID: `prj_FnTvwKSqORkpUmfckY8K5nBmUQti`
- Runtime setting observed: Node.js 24.x
- Latest production deployment ID: `dpl_Acz3iCNuXygkhwkWSEgbPhPk1xTL`
- Latest production state: READY
- Build output recorded source commit: `7f15889ea66b672bd918a8b7ba61a904f6b4da3d`
- Root route observed: HTTP 200
- `/app/` observed: HTTP 200
- Deployment history observed: four production deployments, two READY and two ERROR.

The Vercel project-list call returned no projects, while exact lookup by project slug succeeded. Discovery output must therefore not be treated as proof that a project does not exist.

## Deployment implementation findings

The Vercel bootstrap clones the default branch at build time rather than receiving a repository checkout pinned by Git integration. The successful build log prints the resulting commit, but branch movement between trigger and clone remains a provenance race unless an expected SHA is supplied and checked.

The build installs all 38 workspaces and compiles `better-sqlite3` from source on Node 24 before building the marketing site and web app. This is slow and expands the build surface. The web JavaScript bundle was approximately 1,136 kB minified and 326 kB gzip, above Vite's 500 kB warning threshold.

Earlier failed deployments used Node 20 and raw `pnpm install --frozen-lockfile`; the current bootstrap moved to Node 24 and an explicit pnpm 9 invocation. The repository still declares `node >=20`, so local, CI, and Vercel version policy is not pinned to one tested line.

## Current product gaps reported at observed HEAD

- No end-to-end project-open pipeline.
- No reachable import or export flow in the product UI.
- No implemented sync transport or backend.
- Several data-layer libraries remain unconsumed.
- Component, icon, and tool-command coverage remains incomplete.
- The MCP library is not reachable from the product and has no recorded client run.
- Engineering OS remains in shadow mode rather than a required merge check.

## Snapshot lifecycle

- Observed at: 2026-08-04T06:40:48Z
- Expires at: 2026-08-11T06:40:48Z
- Refresh required before: branch protection changes, release decisions, production deployment, platform claims, or repository-wide implementation work.

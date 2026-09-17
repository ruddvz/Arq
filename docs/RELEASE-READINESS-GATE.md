# Release Readiness Gate

The canonical staged release contract is `docs/release/ARQ-RELEASE-EVIDENCE-CONTRACT.md` and its machine-readable policy is `docs/release/ARQ-RELEASE-POLICY.v1.json`.

A release cannot be Green until the selected release stage has exact-head verified evidence for every class required by that policy. Relevant evidence can include locked scope/decisions, static quality, unit/property checks, build, geometry adversarial fixtures, `.arq` create/open/publish/reopen, migration/recovery, real-browser workflows, visual regression, accessibility/device acceptance, performance budgets, import/export loss reports, security/resource limits, required reviews, deployment identity, production smoke and rollback compatibility.

A local mockup, headless benchmark, successful build, open pull request, stale prior-head receipt, or provider “ready” status alone is not release certification. P0/P1 bug severities defined by the release contract remain release-stop for external stages; the release validator derives PASS/BLOCK rather than trusting a hand-authored readiness label.

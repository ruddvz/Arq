# ZEUS adaptive runtime v2

This temporary branch-local note records the bounded v2 implementation lane while GitHub issue metadata is established.

The runtime wraps the existing adaptive budget adviser. It does not replace Zeus 5.0, Engineering OS, evidence/gate/plan/state ledgers, repository intelligence, or protected approval authority.

Closed-loop decisions are limited to:

- `stop-success`
- `proceed`
- `re-evaluate-tier-or-evidence-plan`
- `repair`
- `block-external-evidence`

Executed required failures and authority/evidence promotion defects are repair signals. Required proof that did not execute, independent review that is unavailable, protected owner approval that is unavailable, and current-head proof that did not execute are blockers rather than speculative code-repair signals.

The implementation lives in `scripts/zeus-adaptive-runtime.mjs`, is regression-tested by `scripts/zeus-adaptive-runtime.test.mjs`, and has a dedicated path-scoped workflow. This note is not a new authority source and should be folded into the existing adaptive contract once the v2 layer is reviewed and integrated.

---
name: zeus-adaptive-cto
version: 1.0.0
project: Arq
status: executable-extension
issue: 328
---

# Zeus Adaptive CTO Extension

## Purpose

Zeus 5.0 already has a compact kernel, adaptive tiers, source/module/context budgets, repair limits, evidence and gate ledgers. This extension does not replace those systems. It defines how Zeus should decide whether consuming **more** of an existing tier budget is worth it.

The rule is simple:

> A budget is a ceiling, not a target. Spend another unit of context, tooling, method or agent work only when it can plausibly change the implementation, risk, acceptance, verification, evidence state or delivery decision.

## Files

- Core Zeus limits remain in `.zeus/config.json`.
- Additive tool/parallel/learning policy is in `.zeus/adaptive-cto.json`.
- `scripts/zeus-adaptive-budget.mjs` validates compatibility and advises whether another budget unit should be consumed.
- `scripts/zeus-adaptive-budget.test.mjs` covers ceiling and protected-proof behaviour.

## Usage

```bash
node scripts/zeus-adaptive-budget.mjs --validate
node scripts/zeus-adaptive-budget.test.mjs
node scripts/zeus-adaptive-budget.mjs --tier fast --category sources --used 2 --decision-value yes
node scripts/zeus-adaptive-budget.mjs --tier deep --category toolCallsBeforeReevaluation --used 40 --decision-value yes --protected-proof
```

## What remains authoritative

`FAST-KERNEL.md`, Zeus invariants, Engineering OS, accepted ADRs, current repository state and executed evidence remain authoritative. This extension may reduce redundant work. It may never:

- lower an Engineering OS or protected Zeus gate;
- accept stale critical evidence;
- turn an inferred graph relationship into proof;
- convert renderer state into semantic project truth;
- weaken `.arq`, geometry/unit, AI-apply or production safeguards;
- increase parallel mutation beyond the owned lane merely to improve throughput.

## New routing vocabulary

Future integration into `zeus.mjs compile` should add two independent axes that are intentionally not encoded into the current core kernel yet:

- **uncertainty**: known, resolvable, assumption-bound, blocked;
- **delivery stop**: answer, plan, local implementation, PR, merge, deployment, production verification.

A question about a deep subsystem can therefore remain answer-only. A tiny production mutation can still require deep/current-head proof.

## Value-of-information gate

Before expanding a tier's actual work consumption, determine whether the next operation can change one of:

- implementation choice;
- risk/blast/reversibility classification;
- acceptance criteria;
- verification frontier;
- evidence state;
- delivery decision.

If no, stop.

If yes and the tier ceiling has not been reached, the work may proceed.

If yes but the ceiling is reached, re-evaluate the tier/strategy and record an expansion reason before proceeding.

Protected proof may exceed an ordinary soft ceiling, but the reason must be explicit. Token saving never outranks a required safety, persistence, merge or production proof.

## Tool and parallelism economy

`.zeus/adaptive-cto.json` adds ceilings for:

- tool calls before re-evaluation;
- external research queries;
- browser interactions;
- parallel read-only agents;
- mutation lanes;
- reviewer fan-out as a soft efficiency ceiling.

Existing reviewer/gate requirements override the reviewer soft ceiling. One mutation lane remains the default because repository ownership and semantic-state consistency matter more than artificial agent fan-out.

## Context ranking

When Zeus has multiple candidate sources, prefer by:

1. authority;
2. direct relevance;
3. freshness;
4. expected decision value;
5. size/cost.

The repository-intelligence work in issue #321 may improve navigation and impact selection, but the graph remains derived evidence and does not outrank semantic authority.

## Model capability routing

The extension intentionally names capability classes rather than model providers:

- deterministic/local;
- routine coding/reasoning;
- architecture/high uncertainty;
- independent review;
- visual/browser verification.

Use the least expensive adequate capability for the subtask. 'Cheaper' is not adequate when it cannot prove the protected claim. 'Stronger' is not automatically useful for deterministic extraction or validation.

## Continual harness economy

The current Zeus harness already has a bounded prompt budget. Active lessons should additionally have applicability, exclusions, confidence, validation/supersession state and should leave the active prompt budget when stale or no longer outcome-changing.

Never persist hidden chain-of-thought. Persist concise failure modes, decisions and evidence references.

## Telemetry boundary

Optimisation metrics should be aggregate only. Do not retain raw private prompts or hidden reasoning for cost optimisation.

Useful metrics include actual context/modules/sources/methods vs ceilings, tool calls by class, cache validity, agent/reviewer count, checks, repair rounds, escalation reasons and final evidence state.

## Integration plan

This extension is deliberately additive so Zeus 5.0 remains stable while it is evaluated. After the self-check/tests and representative task evals are green, integrate uncertainty, delivery stop, value-of-information and extension budgets into the existing `zeus.mjs compile`/state path rather than creating another orchestration system.

## Completion rule

Issue #328 is not complete merely because these files exist. Completion requires executed tests, representative fast/standard/deep evals, integration with Zeus compile/state and evidence that average routine work consumption falls without reducing gate correctness.

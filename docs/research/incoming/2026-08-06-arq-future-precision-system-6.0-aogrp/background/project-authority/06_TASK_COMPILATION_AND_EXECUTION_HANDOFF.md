---
source_id: ARQ-OS3-TASK-HANDOFF
source_type: execution-protocol
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ engineering owner
contract_source: 17_INTEGRATION_CONTRACTS_AND_SCHEMAS.md
---

# Task compilation and ZEUS handoff

## Purpose

The Project converts natural language into a bounded, source-aware task record. ZEUS resolves and executes that record inside the repository. This avoids a second prompt framework while preserving context discovered outside the repository.

## Project-side compilation

Record only fields that change execution:

- requested outcome and delivery stop;
- affected user, workflow, surfaces, platforms, and repositories;
- source evidence already inspected;
- explicit constraints and non-goals;
- known conflicts, risks, blast radius, and reversibility;
- expected acceptance and verification;
- external system identifiers;
- requested write actions and user authorisation state;
- assumptions that remain reversible;
- blockers.

Use the task handoff contract in source 17. Do not pre-decide the final ZEUS tier, module routing, method stack, Engineering OS lane, or Language System result. Those belong to the repository's current systems.

## Repository-side sequence

1. Resolve repository, default or intended integration branch, HEAD, and working-tree state.
2. Read `CLAUDE.md` and `.zeus/FAST-KERNEL.md`.
3. Run the current ZEUS compiler on the actual task.
4. Compare Project evidence with live repository evidence.
5. Reject stale or conflicting assumptions.
6. Inspect the smallest relevant code, ADR, tests, and current diff.
7. Execute the smallest complete slice to the requested delivery stop.
8. Run ZEUS-selected checks.
9. Run Engineering OS evidence for the base-to-head diff before merge authority is claimed.
10. Run the Language System ladder for governed wording or claims.
11. Record claim-level evidence states.
12. Stop before GitHub or Vercel mutation unless explicitly authorised.

## Handoff statuses

| Status | Meaning |
|---|---|
| Ready | Required context and authority are sufficient for inspection or local execution |
| Needs reconciliation | Project evidence conflicts with live repository evidence |
| Needs decision | An owner or ADR must resolve a material choice |
| Needs authorisation | The next action is external, destructive, irreversible, or production-facing |
| Blocked | A required source, permission, environment, fixture, or proof is unavailable |
| Complete | Requested delivery stop reached with evidence |

## Anti-patterns

- Pasting all Project sources into a coding prompt.
- Installing this package into `.zeus/`.
- asking a coding agent to implement every recommendation in one change;
- treating a ZIP as a patch;
- using a stale branch name as the source of truth;
- relying on connector summaries instead of exact files and commits;
- letting a planning model lower deterministic checks;
- opening a PR when the requested stop was local analysis or a patch only.

## Final handoff record

Use the task handoff template in source 18 for human review and the structured contract in source 17 for machine transfer. The final record must identify which claims are Verified, Inferred, Assumed, Blocked, or Failed.

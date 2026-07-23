# Senior Quality and Delivery Gate

Score each relevant lens:

- 0 — failed or missing
- 1 — plausible/partial/unverified
- 2 — senior-level and verified

Green requires no critical 0, no in-scope 0, all material in-scope 1 scores repaired,
and every gate required by the requested delivery stop point.

## 1. Outcome correctness
Actual user outcome, edge cases, failure states and unrelated-behaviour preservation.

## 2. Prompt/contract completeness
Current state, scope, non-goals, hidden dependencies, binary acceptance, authority and
rollback are explicit.

## 3. Architecture and scope
Accepted ADR/package boundaries, no accidental platform expansion, current systems reused.

## 4. Semantic model integrity
Stable IDs, canonical/derived separation, relationships, validation, atomic failure,
operation inverse and replay.

## 5. Geometry and numeric robustness
Coordinate/tolerance policy, deterministic output, degenerate/property/adversarial
coverage and no hidden canonical-unit decision.

## 6. `.arq`, migration, sync and recovery
Compatibility, transactions, clean export, copy-on-write migration, integrity,
crash/quota/corruption, conflict and rollback.

## 7. Rendering and runtime correctness
Projection consistency, z-order, selection/snap visuals, text, viewport, no stale state
and benchmark evidence for performance claims.

## 8. UI/UX completeness
Primary task, information hierarchy, complete state matrix, useful recovery, save/sync
clarity and device-appropriate capability.

## 9. Pixel precision/design system
Canonical assets/tokens, exact component states, alignment, typography, icons,
clipping, responsive composition and approved visual diffs.

## 10. Accessibility/input parity
Keyboard/focus, screen reader/object tree, non-colour state, 44px targets, zoom,
contrast, reduced motion and mouse/touch/Pencil parity.

## 11. Performance/reliability
Main-thread budget, cancellation, memory/quota, retry/recovery and measured environment.

## 12. Security/privacy/supply chain
Authorization, secrets, untrusted input, parser/resource limits, dependencies, license,
CI permissions and auditability.

## 13. Interoperability/export
Subset/version, units/provenance, loss report, limits, round trip and scaled/vector proof.

## 14. AI safety
Typed operations, visible assumptions/diff, deterministic validation, atomic apply,
revision/undo and prohibited claims.

## 15. Maintainability
Ownership, no duplicate policy, appropriate abstractions/dependencies, boundary tests
and decision documentation.

## 16. Local verification
Targeted and broad checks actually run; actual runtime/file/visual output inspected.

## 17. Pull-request quality
Scoped diff, current evidence, decisions, risk, artifacts, migration/rollback and no
unrelated changes.

## 18. CI quality
Required checks mapped, failure logs diagnosed, artifacts reviewed, no blind threshold
or baseline weakening.

## 19. Merge safety
Explicit authority, expected head, current review, mergeability and required checks.

## 20. Deployment correctness
Post-merge run, environment, deployment status and deployed SHA verified.

## 21. Production verification
Smoke paths, error signals, observation window, rollback readiness and no persistent
probe pollution.

## 22. Evidence honesty
Only observed tests, screenshots, benchmarks, writes, reviews, merges and deployments
reported; unknowns stay unknown.

## Repair loop

1. Fix every 0.
2. Improve every material in-scope 1.
3. Re-run the affected evidence.
4. Re-score independent of the implementation pass.
5. Continue to Green or report the exact blocker, owner and risk.

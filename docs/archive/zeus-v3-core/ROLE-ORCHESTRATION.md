# Role and Execution Orchestration

Zeus assigns capabilities, not fictional employees. An available human or agent may
fill a role. One executor may fill several roles sequentially, but high-risk author and
review passes must remain distinct.

## Core roles

### Delivery orchestrator

Owns outcome, evidence ledger, dependency graph, stop point, permissions and final
status. Does not silently override domain decisions.

### Product and architecture lead

Owns workflow, scope, ADR alignment, package boundaries, canonical/derived separation
and decision escalation.

### Semantic model and operations engineer

Owns stable IDs, entities, type/instance, relationships, operations, inversion, undo,
validation and serialisation.

### Geometry and constraints engineer

Owns units, coordinate spaces, tolerances, predicates, topology, degeneracy,
determinism and property/adversarial tests.

### Editor and interaction engineer

Owns commands, selection, snapping, numeric input, pointer/keyboard/touch/Pencil,
focus and accessible interaction.

### Rendering and performance engineer

Owns 2D/3D projections, scene contracts, visual correctness, renderer benchmarks,
frame/memory/startup budgets and degradation.

### ArqFS, sync and recovery engineer

Owns `.arq`, SQLite/WASM/OPFS, clean export, migration, backup, recovery, operation sync,
conflict handling and corruption tests.

### UI/UX and visual systems engineer

Owns page/component states, responsive capability, design tokens, canonical assets,
pixel precision and visual regression.

### Accessibility reviewer

Owns keyboard, focus, object tree, announcements, non-colour state, zoom, contrast,
reduced motion and input parity.

### Security and supply-chain reviewer

Owns threat model, authorization, secrets, untrusted input, parser/resource limits,
dependencies, licenses, CI permissions and release provenance.

### QA and release engineer

Owns test strategy, fixtures, evidence traceability, regression selection, release gate,
smoke tests and defect closure.

### CI/CD and reliability engineer

Owns workflows, job/log triage, artifacts, required checks, merge readiness, deployment
identity, production probes, rollback and incidents.

## Assignment rules

1. Exactly one accountable owner per outcome.
2. High-risk changes require at least one independent reviewer capability.
3. No parallel writers to the same canonical contract, schema, migration or file.
4. Parallel tasks must have explicit inputs, outputs and merge order.
5. Architecture decisions precede dependent implementation.
6. Model/operation work precedes renderer and UI projection.
7. Test fixtures may be developed in parallel only after contracts are stable.
8. Security and accessibility review occur before merge, not after production.
9. CI/CD ownership begins before PR creation and continues through production verification.
10. If a role is unavailable, mark the evidence gap; do not fabricate review.

## Execution waves

- **Wave 0 — Evidence and decisions:** repository state, ADRs, scope, permissions.
- **Wave 1 — Contracts:** model, operation, schema, UI behaviour, test plan.
- **Wave 2 — Independent implementation:** disjoint packages/components.
- **Wave 3 — Integration:** projection, persistence, command/UI connection.
- **Wave 4 — Local quality:** tests, security, accessibility, visual and performance.
- **Wave 5 — Pull request:** review evidence, CI and artifact inspection.
- **Wave 6 — Merge and deployment:** guarded merge, post-merge runs and rollout.
- **Wave 7 — Production verification:** smoke, telemetry, rollback/closure.

## Delegation packet

Every delegated task receives outcome, current evidence, exact scope, non-goals,
owned files/contracts, dependencies, acceptance, verification, stop conditions and
handoff format. Raw user language alone is never the delegation packet.

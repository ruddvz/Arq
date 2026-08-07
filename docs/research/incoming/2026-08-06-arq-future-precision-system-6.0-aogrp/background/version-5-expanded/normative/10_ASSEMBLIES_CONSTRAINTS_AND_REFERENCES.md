# Assemblies, constraints, configurations, and references

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

This contract extends the semantic core beyond architectural elements to products, vehicles, machines, and federated systems while preserving domain separation.

## Normative requirements

- Components and subassemblies MUST have stable identity, placement, configuration, interfaces, and reference policy.
- Joints and mates MUST declare degrees of freedom, limits, coordinate frames, and solver status.
- Constraints MUST be typed and report solved, under-constrained, over-constrained, inconsistent, suppressed, or unsupported states.
- Configurations MUST be explicit named parameter and component selections based on immutable revisions.
- External components MUST be pinned to immutable child revision by default. Floating references MUST be visibly marked and excluded from release baselines unless policy allows.
- Interference and clearance results are evidence tied to geometry revision, configuration, tolerance, and solver version.

## Required invariants

- Circular references.
- Missing child project.
- Mate references ambiguous face.
- Configuration changes part availability.
- Clearance tolerance mismatch.
- Solver finds multiple solutions.

## Known failure modes

- Assembly placement cannot depend on render hierarchy.
- A solver result does not rewrite canonical parameters without an accepted operation.
- A released configuration resolves every required reference.

## Required evidence

- Kinematic fixtures.
- Interference golden cases.
- Pinned-reference offline tests.
- Configuration matrix tests.
- Solver non-convergence diagnostics.

## Implementation guidance

- Implement simple rigid placements before general kinematics.
- Represent interfaces semantically so kernel geometry can change.
- Store solver evidence separately from accepted design decisions.

## Open decisions

- Initial mate and joint vocabulary.
- Cross-project ownership and access rules.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

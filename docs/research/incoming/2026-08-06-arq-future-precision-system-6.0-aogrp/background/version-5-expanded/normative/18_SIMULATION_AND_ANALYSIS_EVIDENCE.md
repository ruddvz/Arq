# Simulation and analysis evidence

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Analysis results support decisions but do not become canonical design truth or professional approval automatically. Every result is tied to exact geometry, assumptions, solver, mesh, boundary conditions, and limitations.

## Normative requirements

- An analysis request MUST identify source revision, configuration, geometry selection, material model, loads, constraints, environment, solver adapter, version, convergence criteria, and requested outputs.
- Analysis geometry and mesh MUST have content digests and mapping back to semantic objects.
- Results MUST report completed, failed, non-converged, partial, approximate, unsupported, or cancelled state.
- Optimisation candidates MUST enter ARQ as proposals, not automatic accepted geometry.
- Professional or regulatory approval MUST be represented as a separate external evidence record with authority, scope, date, and document reference.

## Required invariants

- Wrong units.
- Stale geometry.
- Poor mesh quality.
- Non-convergence hidden.
- Material assumptions missing.
- Result mapped to wrong face.
- Optimiser violates domain constraints.

## Known failure modes

- Rerunning with changed inputs creates different evidence.
- A colourful plot is not a validated result.
- Solver success does not prove real-world safety.

## Required evidence

- Analytical benchmark cases.
- Solver version pinning.
- Input and output hash checks.
- Convergence and sensitivity reports.
- Independent review records where required.

## Implementation guidance

- Build adapters, not embedded universal solvers.
- Keep solver input packages reproducible.
- Show assumptions and limitations before allowing result-based design changes.

## Open decisions

- First supported analysis domains.
- Cloud versus local solver policy.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

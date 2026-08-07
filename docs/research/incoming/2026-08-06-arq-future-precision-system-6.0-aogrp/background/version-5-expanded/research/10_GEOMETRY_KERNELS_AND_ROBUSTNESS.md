# Geometry kernels and numerical robustness research

**Status:** Research and proposal input. External sources do not establish current ARQ implementation truth.

## Scope

Open CASCADE, Truck, Manifold, SolveSpace-style solvers, and hybrid exact/mesh approaches are evaluated as candidate components behind a kernel-neutral ARQ adapter.

## Verified source observations

- Open CASCADE provides mature B-Rep topology and geometry algorithms, booleans, sweeps, lofts, fillets, meshing, validation, and topology-history mechanisms.
- Truck explores a Rust-native CAD kernel and is relevant to a Rust/WASM architecture, but maturity and coverage must be measured against ARQ fixtures.
- Manifold focuses on robust manifold mesh operations and can support concept geometry, booleans, repair, and derived workflows without replacing exact B-Rep.
- Constraint solvers and geometry kernels solve different problems. Sketch constraints, feature dependency, topology naming, and semantic identity remain application responsibilities.

## Lessons for `.arq`

- Create a narrow kernel adapter with versioned requests, deterministic inputs, bounded execution, structured diagnostics, topology history, and canonical output checks.
- Run the same golden fixtures across native and WASM targets, kernel versions, and CPU architectures.
- Store recipe and evidence separately from optional kernel payloads.
- Never promote a regenerated shape when validation fails. Preserve previous accepted canonical state.

## Gaps ARQ can address

- ARQ can make kernel uncertainty and degraded geometry explicit rather than rendering the last mesh as though it were current.
- ARQ can support multiple geometry representations under one semantic model.
- ARQ can introduce kernel upgrades through measured migration rather than silent regeneration.

## Primary sources consulted

- Open CASCADE modelling algorithms, EXT-OCCT.
- Truck repository, EXT-TRUCK.
- Manifold repository, EXT-MANIFOLD.

## Limits

- No kernel was built or benchmarked in this package.
- Licensing, WASM size, threading, precision, and performance require a repository bakeoff.

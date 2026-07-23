# Performance and token budgets

The benchmark utility measures the deterministic compiler/router in-process and the
project-index/cache/context paths on a real repository.

Targets are safeguards, not universal promises:

- compiler/router p95 ≤5 ms in-process;
- compact contract ≤4,000 JSON characters;
- project-index cache hit ≤250 ms;
- ranked context query ≤500 ms after index;
- default fast context ≤8,000 retrieved characters;
- no more than one specialist module in fast tier.

Fresh indexing and repository checks depend on repository size, disk, package manager
and test duration. Zeus reports actual timing rather than calling all work instantaneous.

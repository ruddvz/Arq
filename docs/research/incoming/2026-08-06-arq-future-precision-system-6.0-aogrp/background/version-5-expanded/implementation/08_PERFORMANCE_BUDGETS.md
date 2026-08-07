# Performance budgets and measurement

Budgets must be measured against named devices and project classes. Proposed initial measurement categories are listed below. Numeric thresholds require repository benchmarking and product acceptance.

## File workflow

- Preflight time and peak memory by file size and entity count.
- Time to first trustworthy compatibility verdict.
- Portable publication throughput and additional temporary storage.
- Fresh-reader reopen and canonical comparison.
- Recovery scan time.

## Editing

- Operation validation latency.
- Dependency invalidation breadth.
- Geometry worker queue time and cancellation.
- Render update latency.
- Undo and branch switch latency.

## Large projects

- Loaded semantic objects, geometry payloads, and render primitives.
- Spatial query latency.
- LOD transition cost.
- Federation resolution and missing-reference handling.
- Cache hit rate and safe eviction.

## MCP

- Resource size and redaction time.
- Proposal validation latency.
- Task concurrency and TTL cleanup.
- Approval-to-commit revalidation latency.

Performance tests must fail safely. A timeout or memory cap may produce a bounded diagnostic, never a partial accepted model mutation.

# Adaptive execution

## Fast tier

Use when change is local, reversible and does not affect protected architecture or
external systems. Retrieve ≤4 sources, load ≤1 specialist module, run focused checks,
and cache successful checks for up to the configured TTL when the worktree fingerprint
is identical.

## Standard tier

Use for multi-file or user-visible workflows. Retrieve ≤10 sources, load ≤4 modules,
run affected package tests, typecheck/lint/build as available and perform a separate
review pass.

## Deep tier

Use for `.arq`, migrations, geometry/topology, constraints, sync, security, AI apply,
interoperability loss, merge, deployment, incident or production. Retrieve ≤24 sources,
load ≤8 modules, disable evidence-cache reuse and run all applicable rehearsals,
security, recovery, CI and production gates.

## Escalation

Escalate immediately when evidence reveals broader impact, a source contradiction, a
permission boundary, data-loss possibility, unsupported device behaviour or a failed
critical gate. De-escalation requires evidence, not intuition.

## Parallelism

Parallelise independent reads and independent checks. Never parallel-write the same
canonical file, schema, ADR, migration or baseline. One owner integrates the result.

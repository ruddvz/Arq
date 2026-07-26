# ADR-003: Directed derivation, constraints, and BIM relations stay separate

**Status:** accepted  
**Date:** 24 July 2026

## Context

A directed acyclic graph is good for recalculating derived values. It is not sufficient for bidirectional geometric constraints or cyclic semantic relationships.

## Decision

Arq uses:

- a semantic relationship graph for host, containment, type, and join relations
- a directed derivation DAG for formula and generated-product recompute
- constraint groups for algebraic constraints
- kernel-owned topology graphs for B-Rep adjacency

## Consequences

- Level changes can propagate efficiently.
- Over-constrained sketches report solver diagnostics instead of artificial DAG cycles.
- Semantic relations may be cyclic when domain-valid.

## Rejected alternatives

- One generic graph for every relationship
- Forcing all constraints into topological ordering

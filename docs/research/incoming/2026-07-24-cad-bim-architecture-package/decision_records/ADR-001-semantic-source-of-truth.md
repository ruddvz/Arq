# ADR-001: Semantic parametric document is the source of truth

**Status:** accepted  
**Date:** 24 July 2026

## Context

Rendering engines store disposable GPU-oriented objects. B-Rep kernels store geometry but do not by themselves preserve all BIM meaning. Arq needs stable editing, undo/redo, interchange, and later collaboration.

## Decision

Arq persists a schema-versioned semantic parametric document in float64. It stores element IDs, types, properties, relations, placements, parameters, formulas, coordinate policy, tolerance policy, and commands.

Meshes, renderer objects, kernel shape handles, selection IDs, and spatial indexes are derived caches.

## Consequences

- Rendering and kernel implementations can evolve without file-format lock-in.
- Undo, import mapping, and collaboration operate on meaningful commands.
- Geometry must be regenerated after load; this is an intentional cost.
- All feature work must define semantic schema before render code.

## Rejected alternatives

- Persisting Three.js objects or mesh buffers
- Treating B-Rep topology alone as the full building model
- Storing only command history without validated snapshots

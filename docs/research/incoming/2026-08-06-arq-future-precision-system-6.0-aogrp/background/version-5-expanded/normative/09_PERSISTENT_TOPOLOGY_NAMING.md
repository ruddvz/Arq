# Persistent topology naming and selection

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Persistent selection links semantic intent such as a dimension, fillet, constraint, material face, assembly mate, or annotation to geometry that may change after regeneration.

## Normative requirements

- Permanent selections MUST NOT use triangle index, vertex offset, kernel pointer, transient face index, or generation order as sole identity.
- A selection descriptor MUST combine semantic owner, feature lineage, geometric signature, adjacency, orientation, dimensional relationships, and selection role where applicable.
- Regeneration MUST produce selection resolution evidence: exact, rebound, ambiguous, missing, invalidated, or unsupported.
- A dependent operation MUST block on ambiguous or missing required selection unless the operation schema defines a safe fallback approved by the user.
- Rebinding MUST record old descriptor, candidates, confidence evidence, chosen result, and actor or policy.

## Required invariants

- Symmetric faces.
- Split or merged faces.
- Boolean deletion.
- Fillet reorder.
- Tolerance-induced signature drift.
- Imported geometry without lineage.
- Kernel-version divergence.

## Known failure modes

- Silent wrong-face attachment is worse than explicit failure.
- Selection identity is application-level, not delegated entirely to the kernel.
- Rebinding cannot change semantic intent without a new accepted operation.

## Required evidence

- Topology-changing golden fixtures.
- Symmetry ambiguity tests.
- Cross-kernel selection tests.
- Human rebinding audit fixtures.
- Negative test proving no silent arbitrary choice.

## Implementation guidance

- Start with stable references to semantic construction features, not arbitrary imported faces.
- Show the affected dimensions, constraints, mates, annotations, and simulations in the conflict UI.
- Keep selector algorithms versioned.

## Open decisions

- Confidence thresholds.
- Cross-kernel signature compatibility.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

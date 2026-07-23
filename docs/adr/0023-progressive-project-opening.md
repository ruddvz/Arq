# ADR-0023: Progressive project opening

**Status:** Proposed
**Date:** 2026-07-22

## Decision

Open the last active view using indexed canonical data before loading inactive
resources and 3D detail.

## Consequences

- First useful view appears quickly
- Requires view and bounding-box indexes
- Background validation and mesh generation must be cancellable

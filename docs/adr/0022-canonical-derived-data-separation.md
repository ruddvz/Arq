# ADR-0022: Canonical and derived data separation

**Status:** Proposed
**Date:** 2026-07-22

## Decision

Canonical semantic data lives in `.arq`. Device-specific render and index caches are
replaceable and local by default.

## Consequences

- Smaller and safer project files
- Faster device-specific optimisation
- Every derived system must be reproducible

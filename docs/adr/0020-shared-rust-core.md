# ADR-0020: Shared Rust core

**Status:** Proposed
**Date:** 2026-07-22

## Decision

Implement deterministic operations, validation, hashing, migrations and selected
geometry predicates in Rust. Compile to native and WebAssembly targets.

## Consequences

- Better cross-platform parity
- Server and client validation can share code
- Requires controlled FFI and WASM boundaries
- Does not replace TypeScript UI or renderer code

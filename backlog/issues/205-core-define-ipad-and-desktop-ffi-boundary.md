# core: define iPad and desktop FFI boundary

**Issue ID:** ARQ-205
**Phase:** File-system and instant architecture foundation
**Priority:** critical

## Problem

Arq needs one fast, recoverable and cross-platform native project format and runtime.

## Scope

Define ipad and desktop ffi boundary.

## Acceptance criteria

- [ ] Follows ADR-0019 through ADR-0023.
- [ ] Does not synchronise raw SQLite database bytes.
- [ ] Preserves canonical model semantics.
- [ ] Has deterministic tests across native and WASM where applicable.
- [ ] Has crash, quota and malformed-file tests.
- [ ] Documents performance and security effects.
- [ ] Does not require derived caches to open a project.

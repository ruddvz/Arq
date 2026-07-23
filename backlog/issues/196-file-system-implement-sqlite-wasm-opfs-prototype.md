# file-system: implement SQLite WASM OPFS prototype

**Issue ID:** ARQ-196
**Phase:** File-system and instant architecture foundation
**Priority:** critical

## Problem

Arq needs one fast, recoverable and cross-platform native project format and runtime.

## Scope

Implement sqlite wasm opfs prototype.

## Acceptance criteria

- [ ] Follows ADR-0019 through ADR-0023.
- [ ] Does not synchronise raw SQLite database bytes.
- [ ] Preserves canonical model semantics.
- [ ] Has deterministic tests across native and WASM where applicable.
- [ ] Has crash, quota and malformed-file tests.
- [ ] Documents performance and security effects.
- [ ] Does not require derived caches to open a project.

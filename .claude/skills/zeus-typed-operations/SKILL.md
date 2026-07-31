---
name: zeus-typed-operations
description: Use for any Arq mutation, command, reducer, history entry, replay, undo, redo, AI apply or sync operation.
---

# zeus-typed-operations

Invariants 14 to 18 govern this work. The load-bearing one is 16: an invalid operation
leaves committed state unchanged. Test the rejection path, not only the accepted one.

## Source of truth

`.zeus/INVARIANTS.md` and `.zeus/modules/architecture.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

REVERSEENGINEER, /reverse. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

---
name: zeus-editor-command-state
description: Use for Arq drawing tools, tool lifecycle, previews, commit, cancellation, modes, keyboard behaviour, undo or multi-step editor commands.
---

# zeus-editor-command-state

Invariants 32 to 36 govern this work. Preview state is not committed state, Escape
cancels preview, and tool state does not leak between commands.

## Source of truth

`.zeus/modules/editor-input.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

/simulate, LENSSTACK. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

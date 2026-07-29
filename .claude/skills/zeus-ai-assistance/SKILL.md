---
name: zeus-ai-assistance
description: Use for Arq AI chat, generation, ArqScript, model changes, tool use, retrieval or automated design assistance.
---

# zeus-ai-assistance

AI proposes typed operations with assumptions, validation, preview, apply and reject.
A rejected or failed proposal mutates nothing. AI never approves or certifies anything.

## Source of truth

`.zeus/modules/ai.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

REDTEAM, /steelman. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

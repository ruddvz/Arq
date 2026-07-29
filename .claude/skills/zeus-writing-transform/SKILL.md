---
name: zeus-writing-transform
description: Use for rewriting Arq UI copy, documentation, ADR prose, reports or support text while preserving verified meaning.
---

# zeus-writing-transform

Rewriting changes wording, never the strength of a claim. If the clearer sentence claims
more than the evidence supports, the sentence is wrong, not the evidence.

## Source of truth

`.zeus/INVARIANTS.md`. This skill routes; it does not restate. When the source and this file disagree,
the source wins and this file is the defect.

## Typical method stack

/human, /clarify, /shorten, /rewrite. Confirm with `node scripts/zeus.mjs method --task "<request>"`.

## Required finish

Report the real result, the evidence state behind it, what was not inspected, and the
next action. Never present an uninspected claim as verified.

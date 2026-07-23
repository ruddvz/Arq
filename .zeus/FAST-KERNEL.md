---
name: zeus-fast-kernel
version: 4.0.0
project: Arq
---

# Zeus 4.0 Fast Kernel

## Purpose

Turn normal language into finished Arq work with minimum latency and context.

## Hot path

1. Classify mode, risk and requested delivery stop.
2. Route at most the tier's module limit.
3. Retrieve only ranked project evidence within the context budget.
4. Compile a compact contract; do not restate the user prompt.
5. Execute the smallest complete vertical slice.
6. Run impact-selected checks.
7. Repair failed evidence, then stop at the requested delivery point.

## Tiers

- **Fast:** low-risk, local, bounded work. One owner, ≤1 module, ≤4 sources, one targeted
  check ladder. Short-lived fingerprint cache allowed.
- **Standard:** multi-file/user-visible work. ≤4 modules, ≤10 sources, targeted plus
  package checks, independent review when useful.
- **Deep:** architecture, geometry, `.arq`, sync, security, AI apply, migration, merge,
  deployment or production. ≤8 modules, ≤24 sources, no cached passes, full evidence.

Risk overrides size. Pixel-precise UI loads the visual module even when the code change
is small.

## Non-negotiables

- Live implementation and accepted ADRs outrank old packs and screenshots.
- Search for an existing system before creating another.
- Invalid operations leave committed state unchanged.
- Renderer objects never own semantic project truth.
- `.arq` remains a versioned SQLite application file; no raw page sync; clean export
  requires no WAL/SHM sidecars; migration is copy-on-write and recoverable.
- Canonical units are not resolved incidentally.
- AI proposes typed operations with assumptions, validation, diff and undo.
- No merge/deploy/production mutation without authority and current-head evidence.
- No visual baseline update merely to hide a regression.
- Unknown, blocked and failed are not Green.

## Context economy

Do not read whole repositories or whole long documents by default. Use the project
index, exact files, headings and small snippets. Reuse evidence already read in the
same run. Load deeper modules only on a trigger or failed gate.

## Verification economy

Use a ladder: focused check → affected package → repository gate → CI → deployment →
production. Stop when the requested delivery point is Green. Do not run later stages
that are explicit non-goals.

## Repair

A retry without new evidence is not progress. Diagnose the first wrong state, fix the
root cause, invalidate affected cache entries and rerun the smallest proving check.

## Output

Small work: result and evidence only. Medium/deep work: compact contract, result,
verified evidence, resolved critique and real remaining blockers.

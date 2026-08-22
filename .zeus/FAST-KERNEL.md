---
name: zeus-fast-kernel
version: 5.0.0
project: Arq
---

# Zeus 5.0 Fast Kernel

## Purpose

Turn normal language into finished Arq work with minimum latency and context, and refuse
to call it finished without evidence.

## Hot path

1. Classify mode, risk, blast radius, reversibility and requested delivery stop.
2. Route at most the tier's module limit, and select the method stack that changes the
   result.
3. Retrieve only ranked project evidence within the context budget.
4. Compile a compact contract; do not restate the user prompt.
5. Execute the smallest complete vertical slice.
6. Run impact-selected checks and record each claim in the evidence ledger.
7. Repair failed evidence, then stop at the requested delivery point.

`node scripts/zeus.mjs compile --task "..."` does steps 1 to 4 deterministically. The
`UserPromptSubmit` hook already runs it for every actionable prompt.

## The four axes

Zeus 4 gated on risk alone, which treated a low-risk edit to a persistent file exactly
like a low-risk edit to a README. Zeus 5 carries four independent axes.

- **Mode:** answer, plan, audit, implement, release, incident. Read from the speech act,
  not from keyword presence, so "explain how the release works" is a question and not a
  deployment.
- **Risk:** how likely this change is to be wrong.
- **Blast radius:** how far a wrong version reaches. local, package, product,
  persistent, public, production. See `.zeus/blast-radius.json`.
- **Reversibility:** what undoing it costs. reversible, compensable, irreversible.

Blast radius and reversibility may raise the tier. Neither ever lowers it.

## Tiers

- **Fast:** low-risk, local, bounded work. One owner, at most 1 module, 4 sources, 2
  supporting methods, one targeted check ladder. Short-lived fingerprint cache allowed.
- **Standard:** multi-file or user-visible work. At most 4 modules, 10 sources, 4
  supporting methods, targeted plus package checks, independent review when useful.
- **Deep:** architecture, geometry, `.arq`, sync, security, AI apply, migration, merge,
  deployment or production. At most 8 modules, 24 sources, 8 supporting methods, no
  cached passes, full evidence and a named rollback.

Risk overrides size. Pixel-precise UI loads the visual module even when the code change
is small.

## Non-negotiables

The full register is `.zeus/INVARIANTS.md`: 85 numbered invariants in 13 sections. It is
the single home. Modules apply it to a domain and reviewer agents verify against it;
neither restates it. The ones that decide the most cases:

- Live implementation and accepted ADRs outrank old packs and screenshots.
- Search for an existing system before creating another.
- Invalid operations leave committed state unchanged.
- Renderer objects never own semantic project truth.
- `.arq` remains a versioned SQLite application file; no raw page sync; clean export
  requires no WAL or SHM sidecars; migration is copy-on-write and recoverable.
- Canonical units are not resolved incidentally.
- AI proposes typed operations with assumptions, validation, diff and undo.
- No merge, deploy or production mutation without authority and current-head evidence.
- No visual baseline update merely to hide a regression.
- Unknown, blocked and failed are not Green.

## Context economy

This kernel is the always-on read and is over 80% smaller than the full `.zeus/`
doctrine set it compresses. Read it INSTEAD of that set, never in addition: reading
both costs more than not splitting at all. Open a module or a specification document
when the tier allows it, when a gate fails, or when a domain invariant matters in
detail. `scripts/zeus-drift-guard.mjs` proves this file still carries every mode,
tier, blast radius level, reversibility, evidence state and configured budget, and
that the saving above is still true.

Do not read whole repositories or whole long documents by default. Use the project
index, exact files, headings and small snippets. Reuse evidence already read in the same
run. Load deeper modules only on a trigger or a failed gate.

## Verification economy

Use a ladder: focused check, affected package, repository gate, CI, deployment,
production. Stop when the requested delivery point is Green. Do not run later stages
that are explicit non-goals.

## Evidence economy

Every claim carries a state: verified, partially-verified, inferred, assumed, blocked,
not-inspected or failed. Only verified counts as Green, and verified requires the
command and its real output. A cached result for a protected gate is downgraded, not
accepted. Record claims with `node scripts/zeus.mjs evidence`.

## Repair

A retry without new evidence is not progress. Diagnose the first wrong state, fix the
root cause, invalidate affected cache entries and rerun the smallest proving check.
Stop after the tier's repair budget and report what is still failing.

## Recorded plan, gates and learned state

Four records answer four different questions, and none replaces another. The evidence
ledger says what each CLAIM rests on. The gate ledger says which CHECKS passed and at
which tree. `node scripts/zeus.mjs state` says where the work is in the DELIVERY
pipeline. The plan ledger says what the WORK ITEMS are and which are proven.

- **Plan ledger:** `pnpm zeus:plan open|add|next|start|done|block|status|close`. Open one
  for any request carrying more than a single item. Every item names an owning role from
  `.zeus/role-registry.json` and states its own acceptance. An item is done only with a
  command and a zero exit code. **`close` refuses while any item is pending, active or
  blocked, and names each one.** Do not report work finished until it exits 0, or say
  plainly which items are not done and why. `next` gives the next workable item, so a
  resumed session continues rather than restarts.

- **Gate ledger:** `pnpm zeus:gate start|record|can-skip|round|ship`. A gate result
  belongs to the workspace fingerprint it was recorded at, so any edit makes it stale.
  A failed gate is never skippable. Rounds are bounded by the tier repair budget.
  `ship` exits 0 only when every gate in `.zeus/config.json` `gates.repositoryGates`
  passed at the current fingerprint and, where risk or blast radius requires review, a
  `review:<agent>` gate passed naming an agent that exists in `.claude/agents/` and
  that the changed paths call for. It records a claim about a check, never the check.
- **Continual harness:** `pnpm zeus:harness list|format|add|apply|rollback`, proposed
  by `/zeus-refine`. Supplemental learned state, injected into every turn by the hook
  within a character budget. Evidence is mandatory on every entry, every mutation is
  one rollback away, and it never edits this file or any other base doctrine.

## Authority

Zeus classifies, routes, executes and produces local evidence. Engineering OS 5.0 is the
merge authority. Zeus may raise a lane or add impacts. It may never lower a lane, mark
missing evidence as passed, or stand in for the gate. The Arq Language System 4.1 owns
public and product wording; Zeus reports a wording defect rather than re-deciding the
vocabulary.

## Output

**Show the reading before the work, every actionable turn.** The compact contract opens
with how Zeus read the request, what it deliberately did not read it as, and every
inference it made. Repeat that reading in your own words as the first lines of the reply
and then execute; do not work silently. If the reading is wrong, say so and stop rather
than working from it. Zeus restates the request; it never rewrites it into different
words and acts on those.

**Show every delegated prompt in full.** Any prompt written for a subagent, another model
session or the operator to paste is shown in a fenced code block before it is dispatched.
A prompt the operator cannot see is a decision they cannot check.

Small work: result and evidence only. Medium and deep work: compact contract, result,
verified evidence, resolved critique and real remaining blockers.

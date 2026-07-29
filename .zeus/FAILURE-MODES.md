---
name: zeus-failure-modes
version: 5.0.0
project: Arq
---

# Failure modes and repairs

Recurring ways this kind of work goes wrong, with the specific repair. Ordered by how
often they actually happen, not by severity.

## 1. The unearned completion claim

**Shape:** "Tests pass, ready to merge", with no command in the transcript.
**Why:** Reporting is easier than verifying, and a plausible claim reads like a verified
one.
**Repair:** Every completion claim needs a command, an exit code and real output. The
Stop hook blocks a completion claim in a session with no tool evidence at all; the
ledger catches the subtler version. Downgrade to `inferred` and say so.

## 2. Second system syndrome

**Shape:** A new registry, config or doc tree is created next to one that already does
the job, and the two drift.
**Why:** Writing a clean new thing is more pleasant than reading the existing one.
**Repair:** Invariant 7. Search first. This upgrade hit it directly: the reference
package shipped `.claude/rules/` and `docs/operator-source/` covering ground that
`.zeus/modules/`, `docs/adr/` and `STATUS.md` already owned, so those trees were folded
into `.zeus/INVARIANTS.md` instead of installed.

## 3. Over-escalation

**Shape:** A variable rename is routed through a deep-tier review because one token
matched a high-risk module.
**Why:** Conservative defaults feel safe, but a system that treats everything as
critical gets ignored on the thing that actually was.
**Repair:** Weak matches contribute a capped blast radius
(`.zeus/blast-radius.json`, `moduleContribution`). Questions never inherit the risk of
the topic they ask about.

## 4. Under-escalation through wording

**Shape:** "Just tidy up the migration helper" reads as a small task and is treated as
one.
**Why:** Task language describes effort, not consequence.
**Repair:** Blast radius comes from paths as well as words. `zeus impact` classifies the
real changed files, and the worst of the two wins.

## 5. Substring routing

**Shape:** "build" routes the UI module through "ui"; "wallpaper" routes geometry
through "wall"; "improve" routes CI through "pr".
**Why:** `String.includes` is the obvious implementation and is wrong for natural
language.
**Repair:** Fixed in Zeus 5. Token and phrase matching is boundary-anchored with a
bounded inflection suffix. Regression cases are pinned in
`scripts/test-zeus-system.sh`.

## 6. The guard nobody can work with

**Shape:** A deterministic guard blocks writing documentation that quotes a rejected
pattern, or editing a fixture, so it gets disabled.
**Why:** Matching against a whole serialised payload cannot tell a mention from an act.
**Repair:** Match commands against commands and paths against paths.
`quality/fixtures/zeus-guard-cases.json` pins both sides: what must be blocked and what
must not.

## 7. Cached evidence for a protected gate

**Shape:** A green result from five minutes ago is presented as release evidence.
**Why:** The cache exists and is convenient.
**Repair:** `criticalEvidenceCache` is false. A cached entry marked `verified` is
downgraded to `partially-verified` automatically by the ledger.

## 8. Retry without diagnosis

**Shape:** The same check is run three times hoping for a different result.
**Why:** It sometimes works, which is worse than if it never did.
**Repair:** A round with no new evidence does not count against the repair budget as
progress and does not earn another. Diagnose the first wrong state instead.

## 9. Silent conflict resolution

**Shape:** Two sources disagree, and the report quotes the more favourable one.
**Why:** A conflict is uncomfortable and looks like indecision.
**Repair:** Record the conflict, keep the weaker claim, name the owner. See
`.zeus/SOURCE-AUTHORITY.md`.

## 10. Scope drift under "perfect this"

**Shape:** A request to finish one tool becomes a platform refactor.
**Why:** Adjacent problems are visible once you are in the code.
**Repair:** "Perfect this" means the full reasonable scope of the named thing, including
failure and recovery paths. It does not mean the adjacent subsystem. Note what you
found, then stay in scope.

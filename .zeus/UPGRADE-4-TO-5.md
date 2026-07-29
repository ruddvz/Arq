---
name: zeus-upgrade-4-to-5
version: 5.0.0
project: Arq
---

# Zeus 4 to Zeus 5

## What changed, and why

### Fixed: substring trigger matching

Zeus 4 scored a module trigger with `task.includes(trigger)`. Observed consequences on
the real manifest:

| Prompt                                   | Zeus 4 routed | Through                   |
| ---------------------------------------- | ------------- | ------------------------- |
| explain how the build works              | `ui-visual`   | "ui" inside "b-ui-ld"     |
| improve the wallpaper documentation typo | `geometry`    | "wall" inside "wallpaper" |
| rename a variable in the parser guide    | `ui-visual`   | "ui" inside "g-ui-de"     |

Zeus 5 normalises both sides and matches on token and phrase boundaries with a bounded
inflection suffix, so "walls" still matches "wall" and "wallpaper" does not. Negative
phrases exist too: "unit test" no longer routes the geometry module through "unit".

### Fixed: mode read from keywords instead of the speech act

Zeus 4 decided mode by keyword presence. "explain how the build works" became an
implementation task because it contained "build", and "explain the release process" was
escalated to `production-verified` because a later line unconditionally raised the
delivery stop whenever "deploy", "production" or "ship" appeared anywhere.

Zeus 5 reads the speech act from clause openings. A question is a question. `answer` and
`plan` modes never escalate the delivery stop, never inherit the risk of the topic they
ask about, and never buy a deep execution budget on topic alone.

### Added: blast radius and reversibility

Zeus 4 gated on risk alone, so a low-risk edit to `packages/arqfs` and a low-risk edit to
a README were treated identically. Zeus 5 adds two axes: how far a wrong version reaches
(local, package, product, persistent, public, production) and what undoing it costs
(reversible, compensable, irreversible). Both can raise the tier; neither can lower it.
Both are derived from task language and, in `zeus impact`, from the real changed paths.

### Added: method selection

Zeus 4 routed domain modules but never selected a reasoning method.
`.zeus/method-registry.json` holds 98 retained methods with scopes, so the stack is
chosen deterministically and a marketing method is never proposed for a geometry defect.
`zeus method` shows the selection and the reason for each entry.

### Added: typed evidence states

Zeus 4 graded a run. Zeus 5 grades each claim: verified, partially-verified, inferred,
assumed, blocked, not-inspected, failed. Only verified is Green, and verified requires a
command and its real output. `zeus evidence report` exits non-zero otherwise.

### Added: one invariant register

Zeus 4 kept a short non-negotiables list in the kernel and longer versions inside
modules. `.zeus/INVARIANTS.md` is now the single home: 85 numbered invariants in 13
sections, referenced by the kernel, the modules, the skills and the reviewer agents.

### Added: independent reviewer agents

Six domain reviewers plus an orchestrator under `.claude/agents/`, each bound to the
invariant sections it verifies. The compiled contract names which reviewers apply, so
"independent critique pass" is now an instruction with an address rather than a wish.

### Added: OS self-validation

`zeus verify` answers "is Zeus installed". `zeus validate` answers "is Zeus internally
consistent": manifests, registries, skills, agents, hooks and schemas are cross-checked
against each other.

## Breaking changes

- `.zeus/config.json` and `.zeus/module-manifest.json` are version `5.0.0`. A Zeus 4
  manifest with flat `triggers` arrays is rejected by `zeus validate` with a message
  naming the required `phrases` and `tokens` fields.
- The compact contract gained `blastRadius`, `reversibility`, `methods` and
  `reviewAgents`. Consumers that pinned the Zeus 4 shape should read the new fields
  rather than assume their absence.
- `zeus impact` output gained `blastRadius`, `reversibility`, `fromPaths` and
  `fromTask`. Existing fields are unchanged.
- `budgets.*.supportingMethods` is required.

## Not changed

The context budgets, the incremental index, worktree fingerprints, the short-lived
low-risk check cache, the impact-selected check ladder and the single CLI all carry over
from Zeus 4 unchanged. They were the parts that were working.

Engineering OS 5.0 remains the merge authority and the Arq Language System 4.1 remains
the language authority. Zeus 5 does not take either role, and `zeus validate` fails if
the language guardian is ever removed from the hook chain.

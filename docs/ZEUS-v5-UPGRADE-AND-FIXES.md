# Zeus 4 audit and Zeus 5 corrections

Zeus 4 was fast and deterministic where it counted: a tiny kernel, module routing, hard
context budgets, incremental indexing, worktree fingerprints, short-lived low-risk check
caching and one CLI. Those parts carry over unchanged.

What Zeus 4 got wrong fell into three groups: a matcher that was wrong for natural
language, a gating model with only one axis, and a reporting model that graded runs but
not claims.

## 1. Routing defects, reproduced

Zeus 4 scored module triggers with `task.includes(trigger)`. Against the real Zeus 4
manifest, on the real repository:

| Prompt                                     | Zeus 4 result                        | Cause                                                                                                       |
| ------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `explain how the build works`              | mode `implement`, module `ui-visual` | "ui" inside "build"; and "build" in the action-verb list defeated the question branch                       |
| `improve the wallpaper documentation typo` | module `geometry`                    | "wall" inside "wallpaper"                                                                                   |
| `rename a variable in the parser guide`    | module `ui-visual`                   | "ui" inside "guide"                                                                                         |
| `explain the release process`              | delivery stop `production-verified`  | the stop was raised unconditionally whenever "deploy", "production" or "ship" appeared anywhere in the text |

The last one is the serious one. A question about the release process compiled a
contract whose delivery stop was a production deployment.

Zeus 5 normalises task and trigger the same way and matches on token and phrase
boundaries with a bounded inflection suffix, so "walls" matches "wall" and "wallpaper"
does not. Modes are read from clause openings rather than keyword presence, and `answer`
and `plan` modes cannot escalate the delivery stop, inherit the topic's risk, or buy a
deep budget. Negative phrases were added: "unit test" no longer routes geometry through
"unit".

Every row above is now a regression case in `scripts/test-zeus-system.sh`.

## 2. One gating axis was not enough

Zeus 4 carried risk only, so a low-risk edit to `packages/arqfs` and a low-risk edit to a
README were gated identically. Risk answers "how likely is this to be wrong". It does
not answer "how far does a wrong version reach" or "what does undoing it cost".

Zeus 5 adds **blast radius** (local, package, product, persistent, public, production)
and **reversibility** (reversible, compensable, irreversible), in
`.zeus/blast-radius.json`. Both are derived from task language and, in `zeus impact`,
from the real changed paths, with the worse of the two winning. Both can raise the tier
and add acceptance criteria; neither can lower anything.

Persistent radius adds "original preserved", "copy-on-write verified before promotion"
and "recovery path exercised". Irreversible adds an explicit operator confirmation step.

Building this surfaced its own over-escalation defect: a module matching on one weak
token was dragging unrelated work into a deep lane, so `rename a variable in the parser
guide` classified as public and deep. Weak matches now contribute a capped radius
(`moduleContribution` in `.zeus/blast-radius.json`), and that case classifies as
package and fast.

## 3. Runs were graded, claims were not

Zeus 4 reported green, partial, blocked, failed or rolled_back for a run. There was no
place to record that one sentence in the report rested on an executed command and
another rested on reading a file, so a run could be green while parts of it were
guesses.

Zeus 5 gives every claim a state: verified, partially-verified, inferred, assumed,
blocked, not-inspected, failed. Only verified is green, verified requires a command and
its exit code, and a cached entry for a protected gate is downgraded automatically.
`node scripts/zeus.mjs evidence report` exits non-zero unless every claim is verified.

## 4. Additions

**Method selection.** Zeus 4 routed domain knowledge but never selected a reasoning
method. `.zeus/method-registry.json` holds 98 retained methods (94 distinct behaviours,
4 aliases) with scopes, so selection is deterministic and scope-gated: a marketing
method is never proposed for a geometry defect. `zeus method` shows the stack and the
reason for each entry.

**One invariant register.** `.zeus/INVARIANTS.md` holds 85 numbered invariants in 13
sections. Previously the kernel held a short list and modules held longer overlapping
versions, so the same rule drifted in three places.

**Independent reviewers.** Six domain reviewer subagents plus an orchestrator under
`.claude/agents/`, each bound to the invariant sections it verifies. The compiled
contract names which apply, so "independent critique pass" has an address.

**Self-validation.** `zeus verify` answers "is Zeus installed". `zeus validate` answers
"is Zeus internally consistent" by cross-checking manifests, registries, skills, agents,
hooks and schemas against each other.

**Deterministic tool guards.** A pre-tool guard blocks destructive commands, secret
access and edits to real project containers. It is adapted to this repository in three
ways the generic version got wrong: `.arq` is also the ArqScript source extension here,
so only real SQLite containers are protected; command patterns are matched against
commands rather than the whole serialised payload; and the content a command _writes_
is treated as data, so authoring a fixture or a document that quotes a rejected pattern
is not blocked.

That last one is deliberately narrow. Only heredoc bodies and `echo`/`printf` arguments
are removed, and nothing is removed when the command could feed the text back to a shell
(`| bash`, `sh -c`, `eval`, `xargs`, `bash <<`). Stripping every quoted string would be
unsafe, because `rm -rf "/"` and `cat ".env"` are real operations whose arguments happen
to be quoted.

Writing those cases exposed a hole that predates Zeus 5: the destructive patterns
anchored on a literal `/`, so `rm -rf "/"` was never caught, by Zeus 4 either. Argument
quoting is now removed before matching. `quality/fixtures/zeus-guard-cases.json` pins
all three sides: what must be blocked, what must not, and the bypasses that must stay
blocked.

## 4b. The same defect class in the architecture lint

`scripts/zeus-architecture-lint.mjs` could not tell a sentence that states a prohibition
from one that breaches it, because it matched patterns over a whole file. The correct
sentence "an invalid operation is rejected whole, there is no partial commit" failed,
and "renderer objects are disposable projections of canonical model data" failed because
`.*` spanned the very clause that made it correct.

Three corrections: match per sentence so a `.*` cannot join unrelated sentences; skip a
sentence that denies or prohibits the pattern it contains; and require an assertive
copula in the renderer rule rather than any intervening text. The negation set excludes
"without" on purpose, so "the AI directly mutates canonical project state without
review" still fails. Findings now quote the offending sentence, and
`quality/architecture-clean/` states every prohibition in natural prose as the
regression proof.

## 5. What was deliberately not adopted

The reference package this upgrade drew on shipped a `.claude/rules/` tree and a
`docs/operator-source/` contract tree. Both covered ground `.zeus/modules/`, `docs/adr/`
and `STATUS.md` already own. Installing them would have created a second source of truth
for the same invariants, which invariant 7 exists to prevent, so their content was
folded into `.zeus/INVARIANTS.md` instead.

It also shipped a blocking write-time language guard duplicating the Arq Language System
4.1 (em dashes, hype, prohibited claims, interoperability overclaims) with path
heuristics instead of real scope resolution. The Language System is more precise and
deliberately splits warn-at-write from block-in-CI. The Zeus guard was reduced to the
product-safety absolutes the Language System does not carry, made warn-only, and scoped
to files outside the guardian's reach so the two never double-report. `zeus validate`
fails if the language guardian is ever removed from the hook chain.

Its 38 granular skills were kept but rewritten as thin routers into `.zeus/`, so a skill
cannot drift from the module it describes. `zeus validate` fails a Zeus skill that does
not reference a `.zeus/` source.

## 6. Unchanged

Engineering OS 5.0 remains the merge authority
(`engineering/30_ZEUS_AND_ENGINEERING_AUTHORITY.md`) and the Arq Language System 4.1
remains the language authority. Zeus 5 takes neither role. It may raise a lane, add an
impact, or report a wording defect; it may never lower a lane, pass missing evidence, or
re-decide governed vocabulary.

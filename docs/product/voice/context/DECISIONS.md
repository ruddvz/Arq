# Decisions made in Arq language system 4.1

## Deployed public copy is a first-class consumer

The GitHub Pages artifact is not outside the language boundary. Public copy is
accepted only when source, static output and deployed response agree on the
same commit. A live scan without a proof is insufficient because it can inspect
a stale deployment.

## U+2014 is prohibited in public and UI copy

Public and UI copy use full stops, colons, parentheses, semicolons or shorter
sentences instead. This is a house-style rule based on the observed deployed
copy. It is not a signal of who wrote a passage and cannot be waived by a
review acknowledgement.

## Editorial quality is not authorship detection

The language system may flag generic, promotional, vague or formulaic copy for
review. It must not infer whether a person or AI wrote a passage, label a writer,
or optimise wording for detector scores. The accepted decision is to evaluate
truth, specificity, evidence, scope and reader action.

## Every public content file has an explicit status

The public-copy inventory is exhaustive for the marketing-content directory.
Each source is claim-bearing with bindings, or non-claim with a reason, owner
and review triggers. A newly added or renamed source fails the integrated check
until it is classified.

## Package and installed-repository verification are separate

The package install map verifies that the distribution can be copied. The
integration contract verifies that a real Arq checkout contains the required
installed files and package scripts. The two checks cannot replace each other.

## Canonical product name

Running prose and UI use **Arq**. Supplied wordmarks/formal brand assets may use **ARQ**. Do not retype/redraw the logo to force casing.

## Native project extension

Use **`.arq`** exactly.

## Language system, not voice guide

The package governs meaning as well as tone. Support and product AI must consume it rather than maintaining their own product vocabulary.

## “Professional instrument”

This is the design/voice direction, not a phrase that must appear in user copy. High-risk UI stays literal.

## Source conflict policy

Do not guess through contradictory authoritative sources. Mark the fact `CONFLICTED`; withhold stronger claims until the product source is reconciled.

## Registry ownership

Tool, panel, view, capability and workspace-state identifiers stay owned by their repo registries. The language system owns visible wording, aliases, exposure and consequence rules around them.

## State exposure policy

Each internal state must be classified:

- `product`: safe to translate into normal user language;
- `diagnostic`: expose only when diagnosis/support warrants it;
- `internal`: do not expose directly.

## Save and sync

Local save and remote sync are permanently distinct concepts. `Saved` alone is avoided where it can be ambiguous.

## Journal and portable file publication

The current demo-plan journal is a separate persistence tier from portable `.arq`
publication. The language system does not resolve the product architecture
decision; it requires UI, support and marketing to name the tier they mean.

## File vocabulary

Compatibility, opening, migration, working copy, publication, recovery and integrity are different states/actions. `Safe mode` is an internal family name, not sufficient user-facing explanation.

## “Safe” and “healthy”

Avoid broad reassurance. Name the check: file integrity, model validation, current local persistence state, or another exact condition. None of these imply building safety or professional approval.

## Tool status

`design-specified-capability-gated` is never a shipping claim.

## Hard versus warning language audit

Hard checks remain narrow and high-confidence: prohibited launch claims, unqualified DWG/RVT support, AI approval/authority language and equivalent high-risk claims.

Warnings cover ambiguous or drift-prone wording such as generic errors/success, save/sync ambiguity, broad privacy/lifetime claims, volatile implementation counts, vague permissions and internal safe-mode wording.

Some high-risk warning classes are `reviewRequired`. In CI they fail unless a
narrow, expiring acknowledgement records why the rendered wording is safe.

## Exact implementation counts

Public counts require generation or a freshness mechanism. Otherwise use non-numeric wording or omit the count.

## Localisation

Translations map canonical term/state IDs to locale strings. They may not collapse semantic distinctions such as save/sync, view/tab or warning/error.

## Narrow punctuation policy

The language system does not ban punctuation generally. U+2014 is prohibited
only in public and product UI copy. Other surfaces may use punctuation when it
improves clarity, subject to their own accessibility and localisation needs.

## Existing launch-claim tests

Retain them. This system supplements rendered public-site checks and must not weaken them.

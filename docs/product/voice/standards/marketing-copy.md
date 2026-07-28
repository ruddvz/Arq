# Public marketing copy standard

## Job of the website

The site should help a visitor answer:

- What is Arq?
- Who is it for first?
- What works today?
- What is planned?
- What is deliberately not promised?
- How are files, interoperability, security, and AI treated?
- Where can I inspect evidence?

## Tone

Distinctive but restrained.

A strong Arq sentence often has one of these shapes:

- object + behaviour;
- principle + consequence;
- capability + limit;
- current state + next milestone.

It must still carry a concrete fact. Do not add a sentence about significance,
the future, industry change or reader confidence unless it provides evidence
that the preceding statement does not already provide.

Examples:

> Arq’s architecture is designed so plan and 3D refer to the same semantic objects.

Do not shorten this to a current product-reachability claim while the 3D current-state conflict remains unresolved.

> Local save does not depend on a sync round trip.

> IFC viewing is Release 2 scope. It is not in the current product workflow.

## Avoid competitor theatre

Do not use competitor weakness as proof of Arq quality.

Avoid:

- "CAD marketing usually lies."
- "Other tools get this wrong."
- "Unlike bloated legacy software..."
- "Revit is broken."

It is fine to explain non-goals and compatibility limits.

## Avoid future guarantees

Do not promise what survives every possible future.

Instead of:

> If Arq disappears, your drawings still open.

Use:

> Arq projects are designed as local files, and ordinary project access must not depend on an active hosted service.

## Current-state claim test

For every present-tense capability sentence, ask:

1. Can a user reach it from the current product?
2. Does `STATUS.md` agree?
3. Is there a test or capability register behind it?
4. Is the wording narrower than the evidence?

If any answer is no, change the state language.

Every public current or reachability assertion must map to a record in
`claim-binding-registry.json`. Release-scope statements must be visibly marked
as planned or pre-release scope. Existing public copy is an observation surface,
not evidence that promotes a claim.

When the claim registry says `LIBRARY_ONLY`, describe the adapter or library
boundary and state that the end-to-end user path is not established. When it
says `CONFLICTED`, do not choose a version of the story for cleaner marketing.

## Planned language

Use:

- planned for Release 2;
- designed but not implemented;
- implemented as a library, not wired into the product;
- under technical validation;
- deferred;
- not committed.

Avoid:

- coming soon;
- almost here;
- around the corner.

## Evidence language

Good:

> The repository includes capability checks for the current workspace layouts.

Better than:

> Works perfectly across devices.

Do not write "experts say", "industry reports", "many users" or similar vague
attribution. Name the source and what it establishes, or make the narrowly
supported statement without borrowed authority.

## Editorial quality gate

Every file in `apps/marketing/src/content` must have an entry in
`public-copy-inventory.json`. Claim-bearing pages list their claim bindings;
non-claim pages explain why no binding applies. Review the headline, card,
snippet and callout as standalone copy. A short fragment must not imply a
stronger state than the full page can prove.

Do not attempt to pass an AI detector. The review asks whether a reader can
inspect a specific product fact, scope and limit.

## Metrics

Do not hard-code implementation counts into marketing unless generated from the repo in the same build.

Prefer links to changelog/status over counts that will drift.

## Headlines

A headline may be concise and memorable, but should remain defensible if quoted alone.

Good:

- Draw plans that behave like buildings.
- A plan editor first.
- Format support, stated exactly.
- Review before co-authoring.

Risky:

- Your archive should outlive your software.
- Our outage can never be your outage.
- Learn on the real thing.

The risky examples are not automatically banned, but they require body copy that narrows the implied claim.

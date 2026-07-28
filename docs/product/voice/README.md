# Arq Language System 4.1

Within Arq this system is named Z Voice. "Z Voice" and "Arq Language System
4.1" refer to the same governed vocabulary, registries and checks.

This is Arq's canonical language architecture. It governs how the product names
objects, commands, states, files, permissions, failures, imports, exports,
recovery, support answers, AI proposals, documentation and public claims.

It is not a tone guide. Its core invariant is:

> The same product fact, object, state, action, limitation or consequence must
> have the same meaning on every surface, and a current claim must be traceable
> to fresh evidence.

## What 4.1 adds

- an installation map that can be verified before integration;
- a source contract that hashes the actual public and UI evidence surface;
- deterministic generated context with no stored local machine path;
- dynamic snapshot validation instead of frozen counts;
- state adapters for implementation-visible journal states;
- claim bindings from public assertions to claim state and evidence;
- conflict records with blocked surfaces and resolution acceptance checks;
- semantic message IDs for file, persistence, permission and AI copy;
- support/AI evidence envelopes and response dispositions;
- versioned consumer compatibility;
- an editorial-quality policy that does not infer authorship or optimise for
  detector scores;
- a complete public-content inventory with claim bindings, owner and review
  triggers; and
- installed-repository verification separate from package-map verification;
- a source, static-artifact and live-site contract for GitHub Pages;
- a complete 17-route public-page inventory plus the 404 page, reconciled with
  the route map and typed page registry;
- a hard U+2014 rule for public and UI copy; and
- a commit-bound deployment proof so a live check cannot approve stale pages.

## The language layers

1. **Engineering**: stable IDs, schemas, diagnostic codes and logs.
2. **Product**: canonical visible labels, actions and state descriptions.
3. **Support**: precise explanations using product terms plus controlled detail.
4. **AI proposal**: request, assumptions, operations, preview, validation,
   approval, provenance and undo.

## Source and claim discipline

Repository code and tests establish what is user-reachable today. Registries own
canonical names and state discriminants. ADRs own accepted decisions. Release
scope owns future intent. Existing marketing copy is a mirror only.

`CURRENT` does not mean that a library exists. It needs user-reachability,
relevant implementation or browser evidence, a fresh source context, and no
unresolved stronger conflict. `LIBRARY_ONLY`, `PLANNED`, `CONFLICTED`, `UNKNOWN`
and `VOLATILE` must be qualified rather than polished into a stronger claim.

## Highest-risk distinctions

- compatible project file vs project actually opened;
- local IndexedDB journal vs portable `.arq` file publication;
- local save vs remote sync;
- file integrity vs model validation vs professional safety;
- adapter/library capability vs end-to-end product reachability;
- designed/gated control vs shipped capability;
- AI proposal vs approved/applied project change.

## Package map

- `00-audit/`: live evidence findings, source conflicts and remediation.
- `01-standards/`: normative writing, UI, support, AI and release rules.
- `02-canonical/`: machine-readable ontology, claims, states, sources,
  contracts, adapters and snapshots.
- `03-machine-layer/`: package/integration validation and drift checks.
- `04-wiring/`: deterministic installation, scripts and CI fragments.
- `05-templates/`: reusable high-risk interaction copy shapes.
- `06-context/`: package decisions and changelog.
- `07-future-readiness/`: support-bot and product-AI consumer contracts.

## Editorial quality and deployed copy

4.1 treats generic or falsely authoritative copy as a product-language risk.
It does not treat style patterns as evidence of AI authorship. Public copy must
be specific, evidence-led and complete in the public-copy inventory. High-risk
patterns prompt a time-limited human review with an evidence path.

The supplied editorial reference is used as a descriptive quality input, not as
a detector or a way to hide AI use. U+2014 is prohibited because the current
site overuses it and Arq wants restrained, direct public copy. It is not a claim
about who wrote a sentence.

Public marketing language passes only when all three checks agree:

1. authored modules pass the public inventory and hard language rules;
2. the static HTML build passes the same hard rules and carries a route-hash
   proof; and
3. the deployed GitHub Pages responses match that proof and its commit.

## Package validation

Run from the package root:

```bash
node 03-machine-layer/build-manifest.mjs
node 03-machine-layer/package-test.mjs
```

`package-test.mjs` validates package structure, canonical references, editorial
policy, public inventory, state and adapter coverage, conflict/claim gates,
install coverage, generated context and manifest integrity. It intentionally
does not claim the package proves a live Arq checkout is current.

## Repository integration

Read `04-wiring/INTEGRATION-READINESS.md`,
`01-standards/deployed-public-site.md` and
`00-audit/PUBLIC-COPY-RECONCILIATION.md` first. Then use
`04-wiring/install-map.json` as the deterministic integration map.

After integration, developers refresh source context intentionally. CI verifies
the installed footprint and public inventory, then the committed context before
refreshing anything. It then runs source, editorial, state, adapter, conflict,
claim, language and rendered-site gates.

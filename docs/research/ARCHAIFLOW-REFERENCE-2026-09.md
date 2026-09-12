# Archaiflow research reference

**Status:** Research reference only. Not an accepted ARQ product decision, implementation plan, architecture decision, backlog commitment, or release requirement.

**Research date:** 2026-09-12

**External source:** https://archaiflow.com

**Purpose:** Preserve a dated, inspectable record of useful Archaiflow patterns that may be relevant to ARQ later. Future work should re-check the external source before relying on any detail here because Archaiflow and ARQ will both evolve.

## Why this exists

Archaiflow is useful to ARQ mainly as a research reference for narrow, evidence-grounded AI and deterministic architectural workflows. The useful lesson is not to copy its product structure or build a large chat-first assistant. The useful lesson is to keep AI around deterministic architectural systems, source evidence, explicit uncertainty, and reviewable changes.

ARQ already has compatible foundations: an authoritative semantic model, typed operations, deterministic validation, reviewable AI proposals, local project ownership, and explicit separation between canonical project state and derived representations.

This note records patterns worth revisiting if future ARQ work needs them.

## Patterns worth keeping as references

### 1. Review Centre / proposal review surface

Archaiflow's strongest pattern is narrow, reviewable automation rather than opaque autonomous mutation.

Potential ARQ application:

- surface AI or automated findings in a dedicated Review Centre;
- show the original request, parsed intent, assumptions, affected elements, exact operations, before/after, warnings, preview, provenance, and validation state;
- distinguish read-only findings from mutation proposals;
- require deterministic validation before any consequential change can be approved;
- keep Apply / Reject / Edit actions explicit;
- preserve grouped undo and provenance.

This aligns with ARQ's existing `docs/ai/AI-PROPOSAL-UX.md` direction and should be treated as reinforcement of that architecture, not a replacement for it.

### 2. Project Search with cite-or-refuse behaviour

Archaiflow's Project Search pattern is valuable because it attempts to answer from supplied project sources and explicitly refuses to invent unsupported facts.

Potential ARQ application:

- search semantic BIM entities and relationships;
- search imported project documents, specifications, sheets, and attachments;
- cite exact objects, document pages, drawing references, or source locations;
- report `not found in project sources` when evidence does not exist;
- report contradictions when two project sources disagree;
- visibly separate project evidence from general model knowledge;
- begin read-only.

ARQ can go further than document-only systems because its project model is structured. A future answer should be able to point to entities such as a wall, room, level, type, view, or source document rather than merely returning prose.

### 3. Deterministic "Explain why" validation

A useful general pattern is to use deterministic code for the actual decision and AI only to explain the result.

Potential ARQ application:

- invalid geometry;
- rejected operations;
- hosted-opening conflicts;
- room boundary failures;
- orphaned dimensions or annotations;
- export problems;
- unresolved references;
- model health warnings.

A finding should identify the exact rule or invariant, affected objects, missing information, and possible resolution paths. AI may translate the result into clearer language, but must not invent the cause.

### 4. Documentation coverage and export preflight

Archaiflow's model-to-document checking suggests a useful ARQ preflight pattern.

Potential ARQ application before sheet/PDF publication:

- unresolved dimensions;
- missing or stale references;
- broken view links;
- orphaned annotations;
- unresolved model warnings;
- invalid room boundaries;
- stale derived projections;
- missing expected sheet content;
- export fidelity warnings;
- any other condition ARQ can deterministically prove.

Recommended evidence states are explicit rather than binary, for example:

- Ready
- Needs review
- Unable to verify

Do not infer professional approval from a green technical preflight.

### 5. Reusable deterministic solver contract

Archaiflow's StairFit work is useful mainly as an architectural pattern: measure first, enumerate feasible candidates, evaluate constraints deterministically, rank survivors, then let AI explain or orchestrate the workflow.

Potential reusable ARQ solver shape:

```text
Snapshot
  -> Measure
  -> Generate candidates
  -> Apply deterministic constraints
  -> Rank survivors
  -> Preview
  -> User approval
  -> Typed operations
```

Possible future applications include:

- sheet/view packing;
- constrained opening placement;
- dimension placement;
- constrained object positioning;
- later, richer architectural solvers when the required domain objects and rules exist.

Do not start by placing code-critical or safety-critical decisions inside an LLM prompt.

### 6. Rule graph / clause-resolution architecture

Archaiflow's zoning work suggests representing external rules as structured clauses and relationships rather than as free-form prompt context.

Potential future ARQ architecture:

- jurisdiction and edition identifiers;
- verified rule corpus;
- clause graph with overrides, exclusions, dependencies, and derivations;
- project facts as a separate input;
- explicit missing-input state;
- provenance for every determination;
- candidate clauses shown when applicability cannot be decided.

AI may retrieve and explain clauses. Deterministic rule logic should decide applicability wherever ARQ claims a machine-verifiable result.

Never equate LLM confidence with building-code compliance.

### 7. Small specialist capabilities instead of one giant agent

Archaiflow is a useful reminder that narrow specialist workflows are easier to inspect and validate than a single omnipotent architecture assistant.

Potential ARQ capability boundaries:

- Search project
- Explain selection
- Explain validation failure
- Check model
- Check documentation
- Analyse impact
- Propose bounded change
- Solve constrained problem

Each capability should declare:

- allowed inputs;
- allowed data sources;
- deterministic tools it may call;
- mutation privileges;
- output schema;
- evidence requirements;
- conditions it cannot conclude.

The product UI does not need to expose these as multiple personas or "agents".

### 8. Geometry-consistent AI rendering

Archaiflow's rendering and walkthrough experiments suggest using model-derived constraints rather than unconstrained image generation.

Potential future ARQ application:

- derive semantic masks from the BIM model;
- derive depth, normals, material classes, and camera metadata;
- generate a disposable visualisation from those constraints;
- compare generated output against source geometry;
- expose model, AI render, semantic mask, and difference views where useful.

AI imagery must remain a derived representation. It must never silently become canonical geometry or evidence of geometric correctness.

### 9. Practice / firm memory as a separate evidence layer

Archaiflow's firm-memory work suggests a useful long-term distinction between project truth and organisation knowledge.

Potential ARQ direction:

- project-specific canonical state remains inside `.arq`;
- firm memory remains separate from individual project files;
- firm knowledge is source-linked, exportable, inspectable, and user-controlled;
- project evidence, firm knowledge, and general model knowledge are presented as distinct evidence classes.

Do not merge cross-project organisational memory into the canonical project model by default.

## Ideas not to copy blindly

The following should not be treated as recommendations merely because they appear in or around Archaiflow research:

- a marketplace of many AI agents;
- chat-first CAD/BIM interaction;
- dozens of persona-style assistants;
- building-code values embedded directly in prompts;
- unconstrained model generation presented as authoritative design;
- automatic whole-building generation before bounded operations are dependable;
- generative rendering or walkthroughs ahead of ARQ's protected authoring workflow;
- external AI reasoning that bypasses ARQ typed operations or validation;
- opaque mutation without preview, provenance, impact analysis, and undo.

ARQ's existing principle remains preferable: AI may interpret, retrieve, propose, explain, and orchestrate, while deterministic systems own geometry, validation, canonical state, persistence, and accepted operations.

## Possible evaluation additions if these patterns are implemented

ARQ's current AI benchmark direction already includes dimensional accuracy, semantic accuracy, valid geometry, assumptions, user corrections, time saved, operation latency, rejection quality, crash rate, and undo success.

If source-grounded research patterns are implemented later, also consider measuring:

- citation correctness;
- unsupported-claim rate;
- abstention correctness;
- missing-input detection;
- source-contradiction detection;
- proposal impact completeness;
- provenance completeness;
- deterministic replay equivalence;
- review-to-apply error rate;
- false confidence / false-ready rate.

These metrics should be tied to reproducible fixtures or real usage evidence. Do not estimate them.

## Relationship to current ARQ priorities

This research note does **not** change the current ARQ release order.

The protected first workflow remains the priority: dependable architectural authoring from plan through coordinated 3D, documentation, scaled PDF, local persistence/recovery, and verified reopen.

If a future issue needs ideas from this note, the safest early implementations are likely to be read-only or validation-adjacent capabilities such as:

- Review Centre UI;
- Explain Why;
- evidence/citation primitives;
- Project Search;
- export/documentation preflight.

These are lower architectural risk than broad natural-language authoring because they reinforce existing ARQ contracts rather than bypass them.

## Revalidation checklist for future agents

Before using anything in this file for implementation:

1. Revisit https://archaiflow.com and the specific relevant research page.
2. Record the access date and source URL.
3. Check current ARQ `main`, accepted ADRs, product blueprint, status file, open issues, open PRs, and current ownership claims.
4. Confirm whether ARQ already implemented the capability independently.
5. Separate generic architectural lessons from Archaiflow-specific implementation details.
6. Check licences and rights before copying code, schemas, prompts, assets, or substantial text. This file records concepts only and does not authorise copying implementation.
7. Keep external research advisory until ARQ's own tests and evidence establish correctness.
8. Create or update an ADR only if an actual architecture decision is being made.
9. Create a bounded implementation issue only when the work is approved and does not duplicate an existing issue.
10. Update this research note when materially newer evidence changes or invalidates a recorded pattern.

## Source pointers captured in the 2026-09-12 research pass

The research pass reviewed the Archaiflow homepage and publicly linked research/workflow material, including patterns around:

- Project Search / document-grounded retrieval;
- StairFit-style deterministic solving;
- zoning clause graphs;
- model-derived rendering and walkthrough constraints;
- firm-memory / Obsidian-style organisational knowledge.

External URLs and product details may change. Treat this section as a discovery index, not a permanent factual specification.

## Bottom line

The enduring research lesson is:

> Put AI around the architectural engine, not in place of the architectural engine.

For ARQ, the strongest reusable ideas are source-grounded project search, reviewable proposals, deterministic explanation, technical preflight, constrained solver contracts, structured rule graphs, evidence-class separation, and geometry-constrained derived visualisation.

Everything else should be re-evaluated against ARQ's current product state when needed.

# ARQ canonical language standard

This file defines ARQ's top-level voice, named Z Voice. The canonical data and
checks behind it live under `docs/product/voice/`.

Domain standards may make the wording more specific. They may not weaken the truth, safety, naming, state, or consequence rules here.

## Voice in one sentence

**Precise enough for professional work, calm enough for long sessions, and honest enough to show state and limits without drama.**

ARQ should sound like a professional instrument.

Not a SaaS salesperson.  
Not a chatty assistant.  
Not a CAD manual that exposes implementation jargon everywhere.  
Not a competitor rant.

## Ten non-negotiables

### 1. State the product state

Every changing capability is one of:

- CURRENT
- LIBRARY_ONLY
- DESIGNED_GATED
- PLANNED
- DEFERRED
- NOT_COMMITTED
- UNKNOWN
- VOLATILE
- CONFLICTED

LOCKED and PROHIBITED describe durable boundaries/decisions.

Present tense implies CURRENT unless the sentence clearly describes architecture, design intent, or a library-only fact.

### 2. Name the exact object

Prefer:

- Wall
- Level
- project file
- view tab
- local journal
- AI proposal

Avoid:

- thing
- item
- content
- document
- model

when a more precise canonical noun exists.

### 3. Name the exact action

Prefer:

- Open read-only
- Export PDF
- Delete Level 2
- Apply proposal
- Review import

Avoid:

- OK
- Continue
- Proceed
- Confirm

for consequential actions.

### 4. Separate system layers

Never conflate:

- semantic model and renderer;
- project and project file;
- project file and working copy;
- local journal and portable `.arq` file;
- local save and remote sync;
- recovery and ordinary save;
- view definition and view tab;
- import and underlay;
- warning and validation error;
- proposal and applied operation;
- code/file integrity and professional design correctness.

### 5. Explain consequences before commitment

If an action changes, deletes, replaces, migrates, restores, imports, exports, or applies operations, show the affected scope before commitment where it matters.

A primary action repeats the outcome.

### 6. Failure explains the safe state

High-risk error copy answers:

1. what happened;
2. why;
3. what was affected;
4. what remains safe;
5. what the user can do.

“No change was applied” is allowed only when the product can prove atomic rejection.

### 7. Do not turn architecture into a guarantee

Describe:

- local-first;
- explicit operation validation;
- copy-on-write migration;
- file integrity checks;
- recovery layers;
- fidelity reports.

Do not turn them into:

- never lose work;
- always open;
- perfectly safe;
- guaranteed accurate;
- works everywhere;
- cannot be locked out.

### 8. Do not hide uncertainty

Use:

- not validated;
- not calibrated;
- unknown;
- not committed;
- unavailable in this build;
- planned;
- approximated;
- omitted;
- stale;
- conflicted.

Avoid:

- probably fine;
- should be safe;
- looks correct;
- almost ready.

### 9. The same name means the same thing everywhere

Tool, panel, mode, view, role, format, and state names come from canonical registries/mappings.

Support and AI may recognise aliases. They answer with canonical terms.

### 10. A source conflict is a product-language state

Do not guess through contradictory maintained sources.

Mark the fact CONFLICTED and resolve against the correct authority.

### 11. Do not use style to simulate evidence

Do not inflate a fact with significance, legacy, broad trends, unnamed experts
or a conclusion that says the same thing again. A polished sentence is not a
stronger claim.

Use the exact object, behaviour, condition and user consequence. If the claim
needs evidence, make the evidence path inspectable. See
`editorial-authenticity.md` for the review standard.

## Voice traits

### Precise

Names actual objects, units, states, scope, and consequences.

### Calm

No panic language. No cheerleading. No celebratory punctuation for routine work.

### Direct

Lead with the fact or action.

### Inspectable

Where trust matters, show reason, provenance, affected scope, or evidence.

### Restrained

Personality is allowed in marketing. It does not belong in validation, recovery, permission, import/export, or AI proposal state.

## Surface voice

### Product UI

Literal and compact.

Examples:

- Saved locally
- Sync not configured
- 3 warnings
- Open read-only
- Resolve 2 blocking errors before export

### Errors and recovery

Procedural and factual.

Example:

> **Wall was not added**  
> The segment is 0.4 mm long, below the 1 mm minimum. No project change was applied. Place the end point farther from the start point.

### Marketing

Distinctive but evidence-led.

Good architecture-language example:

> Plan and 3D are designed to refer to the same semantic objects.

Do not use this as evidence that every coordinated 3D workflow is currently reachable.

Bad:

> The revolutionary future of architecture.

Marketing can state a limitation confidently.

### Editorial quality

Do not treat a phrase match as evidence of AI authorship. Pattern checks exist
to find generic or unsupported copy before release. They do not replace source
review or human editorial judgement.

### Technical docs

Mechanism, version, source, evidence, and uncertainty are welcome.

### Support

Translate internal state into plain language, diagnose minimally, and give only current valid actions.

### AI proposal

Neutral review language:
request, assumptions, operations, preview, validation, affected objects, approval, provenance, apply/reject, undo.

## Product name

Use **ARQ** in public prose, product UI, support, and documentation.

Use lowercase **arq** only for code identifiers, package names, routes where the literal identifier is lowercase, and the `.arq` extension. Preserve case-sensitive deployment paths such as `/Arq`.

Use **`.arq`** for the file extension.

Do not call the product “Arc”.

`arc` remains a legitimate geometry word when it means an actual geometric arc.

## Status wording

Status describes state, not reassurance.

Prefer:

- Saved locally
- Local save failed
- Offline
- Sync conflict
- Proposal is stale
- Opened read-only
- Import completed with omissions

Avoid:

- All good
- Safe
- Healthy
- Perfect
- You're all set

unless the narrow noun makes the claim exact, such as an internal diagnostic labelled “SQLite integrity check passed”.

## Professional boundary

ARQ never claims that the software, support system, or AI establishes:

- professional approval;
- regulatory/building-code compliance;
- structural safety;
- fire safety;
- accessibility compliance;
- constructability;
- cost accuracy;
- design correctness.

## Marketing words to avoid

Avoid unsupported:

- seamless
- effortless
- intuitive
- revolutionary
- game-changing
- cutting-edge
- next-generation
- world-class
- best-in-class
- future-proof
- magic
- smart
- intelligent
- powerful
- enterprise-grade

Replace the adjective with behaviour.

## Competitive posture

Use competitors to explain scope/interoperability where necessary.

Do not use insult as evidence.

Avoid:

- CAD marketing lies
- Revit is broken
- everyone else gets this wrong
- unlike bloated legacy tools

## Numbers and counts

A public exact count must be:

- generated from source, or
- freshness-guarded.

Otherwise prefer the stable fact:

> Tested in CI

over:

> 2,043 tests

when that count will drift.

## Review before shipping

Ask:

1. Is the fact state correct?
2. Is CURRENT genuinely user-reachable?
3. Is a source conflict unresolved?
4. Is the object name canonical?
5. Is the action explicit?
6. Are dependencies/consequences visible?
7. Does failure state what remains safe?
8. Are local save and sync separate?
9. Does file/open wording distinguish compatible from loaded?
10. Does import/export report fidelity?
11. Is permission distinct from capability?
12. Is AI still a proposal until apply?
13. Is professional authority avoided?
14. Is every volatile number fresh?
15. Would support answer with the same underlying meaning?

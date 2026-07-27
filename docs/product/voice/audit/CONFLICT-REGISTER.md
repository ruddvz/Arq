# Arq language and product-truth conflict register

Snapshot date: 27 July 2026.

This register contains contradictions or materially ambiguous states that copy, support, and AI must not resolve by guessing.

A conflict is not necessarily an engineering bug. It is a **truth-source bug** if two maintained sources can cause different user-facing answers.

## CRIT-001: `STATUS.md` contradicts itself about the 3D surface

One maintained section says the web app has a real `ModelCanvas` 3D view that renders drawn walls, supports orbit/pan/zoom/fit, raycast picking, and shares selection with plan.

A later bullet in the same `STATUS.md` says the 3D stack has zero consumers and that no 3D view surface exists yet.

### Risk

- marketing can claim 3D is current while support says it is not;
- an AI system can pick whichever sentence appears closer in retrieval;
- generated “current capability” context becomes nondeterministic.

### Required fix

Resolve the stale bullet in `STATUS.md` against working code/tests.

Until resolved, the language system must not derive a stronger current 3D claim from `STATUS.md` alone. Working code plus tests outrank the contradictory summary.

## CRIT-002: native `.arq` architecture versus current product reachability

The repo's `.arq` libraries implement open/capability/migration/recovery infrastructure, but `STATUS.md` says the end-to-end open-project pipeline is not reachable from the product.

Current marketing copy describes the project as a single `.arq` file that opens in the browser and describes saving as a local file write.

### Risk

The architecture direction is described as current user behaviour.

### Required wording boundary

Allowed:

> `.arq` is Arq's native project-file format.

Allowed:

> The file-format and recovery layers are implemented as libraries.

Not current until end-to-end evidence exists:

> Open a `.arq` project and continue editing it in the browser.

## CRIT-003: semantic building objects in marketing versus currently wired tools

The marketing home currently describes walls, doors, windows, and rooms as available working objects.

`STATUS.md` says door/window/room libraries exist but are not yet wired to the canvas.

### Required fix

Separate:

- current wired authoring;
- implemented but unwired libraries;
- Release 1 target workflow.

## CRIT-004: lifetime and lock-in guarantees exceed evidence

Public copy includes statements equivalent to:

- projects will still open if Arq stops existing;
- stopping payment can never lock a user out;
- an Arq outage can never be the user's outage.

The architecture supports local ownership as a strong design principle, but no software can prove every future environment, browser, OS, migration, corruption, or policy condition.

### Required fix

State the invariant Arq controls:

> Ordinary local project access must not require an active hosted service.

Do not promise indefinite executability under every future condition.

## CRIT-005: “safe”, “healthy”, and compatibility wording

Internal file logic uses a `healthy` safe-mode-plan kind and compatibility checks. These terms can be misleading in user copy.

A “healthy” file in the open-plan logic means the checked compatibility/integrity conditions passed. It does not mean:

- professional correctness;
- no future data loss;
- model correctness;
- code compliance.

### Required fix

Translate internal **healthy** to a narrow user label such as **Compatible project** or **No file-integrity issue detected by this check**, depending on the actual evidence.

## CRIT-006: planned capability can look shipping because design registries are complete

The tool registry explicitly says `design-specified-capability-gated` is a design/coverage marker, not a shipping claim.

### Required fix

Any system that reads the tool registry must ingest both:

- name/group;
- implementation/shipping evidence.

Never convert registry existence into a current capability claim.

## CRIT-007: local journal versus native `.arq` persistence can be mistaken for one save path

The current web editor has a real IndexedDB journal and recovery replay. The repository's intended native project architecture uses SQLite/OPFS, and `STATUS.md` explicitly records an unresolved overlap between the persistence directions before the open-project pipeline is completed.

### Risk

- `Saved locally` can be misread as “portable `.arq` file updated”;
- support may tell a user to close the browser when only in-session/journal state is known;
- future sync language can accidentally build on the wrong persistence tier;
- recovery actions can be described as file repair even when they operate on journal/working-copy state.

### Required fix

Every persistence message must name or semantically identify the concrete tier it knows about. Until the architecture decision is resolved, do not collapse journal, working copy, native project file and remote sync into one `save` concept.

## Conflict handling rule

When a material fact is conflicted:

1. do not guess;
2. prefer working code/tests for “works today”;
3. prefer accepted ADRs for approved architecture decisions;
4. mark the fact `CONFLICTED` in generated context;
5. block promotion to public CURRENT/support certainty;
6. record the source paths and exact conflicting statements;
7. resolve the source, then regenerate context.

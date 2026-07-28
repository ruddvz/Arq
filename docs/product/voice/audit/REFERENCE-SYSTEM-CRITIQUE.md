# Critique of the BookPhysio reference system

The reference package is useful because it gets three important things right:

- one canonical prose standard;
- one shared machine pattern catalogue;
- a non-blocking editor hook plus a small blocking CI class.

Those ideas should be kept. The following parts should not be copied into Arq unchanged.

## 1. Voice is too narrow a boundary

For Arq, the most dangerous copy error is often factual or state-related, not stylistic.

Examples:

- a Release 3 capability described in present tense;
- "Saved" used when the project is only journalled locally;
- "Synced" used when no backend exists;
- `.arq` described in a way that conflicts with the native SQLite direction;
- a disabled tool hidden rather than showing why it is unavailable;
- an import described as "successful" when some content was omitted.

The Arq system therefore adds a canonical claim registry and change-propagation layer.

## 2. Regex should not pretend to judge grammar

The reference package has a passive-voice regex that its own README identifies as noisy. Arq does not include a passive-voice detector. Passive voice is sometimes the clearest form in technical software. A noisy grammar warning damages trust in the whole system.

## 3. Large warning backlogs are a design failure

A warning that nobody can reasonably clear becomes decoration. The Arq rules use fewer patterns, more surface scoping, and a smaller set of findings that have a clear fix.

## 4. Exemptions must not hide important surfaces

Arq has public marketing, editor UI, registry labels, generated reports, validation messages, and page specifications. Internal documentation is not all equivalent.

The audit distinguishes:

- shipping public copy;
- shipping product UI;
- canonical specs;
- internal engineering prose.

Canonical specs are not treated as product copy, but they are included in drift verification because they control product copy.

## 5. Current-state claims need a first-class type

Arq is pre-release and changing quickly. Exact numbers such as test counts, package counts, viewports, or implementation coverage are volatile. The reference model has freshness checks, but Arq needs a general rule:

**Volatile facts must be generated, CI-guarded, or omitted from public copy.**

## 6. Terminology has to follow the command system

A CAD/BIM product cannot tolerate labels that drift by surface. "Wall", "Wall draw", and "Draw wall" may look interchangeable, but users build muscle memory around names.

The Arq system separates:

- canonical tool name;
- command-palette verb phrase;
- group;
- synonyms for search only;
- status wording.

Synonyms help discovery. They do not become visible labels.

## 7. Claim tests should be semantic enough to avoid trivial bypasses

The current marketing test correctly blocks a small set of phrases, but a claim can be equally unsafe without using the exact watched wording. For example:

- "Your projects can never be locked."
- "Our outage can never affect your work."
- "A modest laptop is enough."
- "If Arq disappears, your drawings still open."

The Arq system adds warning rules and a review checklist for absolutes and hardware/lifetime guarantees. Only the zero-false-positive subset blocks CI.

## 8. Copy must vary by risk

Marketing can carry personality. Recovery copy cannot.

This package defines separate surface modes so a witty line on `/ai` does not become the pattern for a file-migration failure.

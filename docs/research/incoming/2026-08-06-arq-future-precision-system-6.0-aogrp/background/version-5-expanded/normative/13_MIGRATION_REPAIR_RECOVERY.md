# Migration, repair, and recovery

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Migration changes format interpretation. Repair attempts to recover from damaged or inconsistent data. Recovery restores a usable state after interruption. None may overwrite the only source before proof.

## Normative requirements

- Migration MUST preserve source bytes and operate on an isolated candidate.
- Each migration step MUST be deterministic, versioned, resumable or restartable, and validate its preconditions and postconditions.
- A migration chain MUST record source version, target version, steps, code build, diagnostics, canonical root before and after, expected semantic changes, and limitations.
- Repair MUST create a new file and classify recovered, reconstructed, omitted, quarantined, and unverifiable content.
- Recovery journals and autosaves MUST identify project, base revision, operation sequence, and last verified checkpoint.
- No repair tool may call the result complete when required data remains missing or ambiguous.

## Required invariants

- Interrupted migration.
- Missing step.
- Extension migration unavailable.
- Integrity passes but semantic root fails.
- Autosave belongs to older branch.
- Repair drops relationships.

## Known failure modes

- Original source remains byte-identical.
- Migration cannot lower required capability without an explicit accepted transformation.
- Recovery never merges unrelated project identities.

## Required evidence

- Every supported version transition fixture.
- Crash injection.
- Backward-read tests.
- Rollback evidence.
- Corruption and partial-recovery corpus.

## Implementation guidance

- Support direct migrations only between bounded windows and compose them deliberately.
- Keep old readers in CI where practical.
- Provide a human-readable migration report and machine-readable evidence.

## Open decisions

- Supported migration window.
- Long-term archival strategy.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

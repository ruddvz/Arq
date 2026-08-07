# File inspector and evidence UX

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

The file inspector makes `.arq` inspectable without requiring SQL knowledge. It supports trust, support, migration review, extension management, and forensic comparison.

## Normative requirements

- The inspector MUST show project ID, publication ID, revision root, format version, capabilities, domain packs, assets, external references, migrations, repair records, publication evidence, and validation status.
- Canonical and derived data MUST be visually separated.
- Unknown or quarantined data MUST show owner namespace, byte size, preservation state, and whether writing may affect it.
- Every evidence item MUST show state, scope, source or command, observed time, limitations, and responsible component.
- The inspector MUST support exporting a redacted machine-readable report without exporting project geometry unless selected.

## Required invariants

- Inspector triggers asset decode.
- Sensitive file paths exposed.
- Unknown extension rendered as trusted.
- Hash displayed without naming what it hashes.

## Known failure modes

- Inspection itself is read-only.
- Derived cache size cannot be mistaken for semantic project size.
- A green evidence record is scoped, not global.

## Required evidence

- Read-only mutation detection.
- Redaction tests.
- Large-file inspector performance.
- Keyboard and screen-reader navigation.

## Implementation guidance

- Use separate tabs for Identity, Capabilities, Revisions, Geometry, Assets, References, Evidence, and Diagnostics.
- Allow copying exact IDs and hashes.
- Show a dependency graph for capabilities and external references.

## Open decisions

- Which inspector fields are available in quarantine.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

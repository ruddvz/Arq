# Interchange fidelity-report UX

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Import and export interfaces must present fidelity before users rely on the result or send it downstream.

## Normative requirements

- The UI MUST name exact format edition, profile, adapter version, units, coordinate frame, and settings.
- Results MUST be grouped by native editable, mapped editable, exact reference, approximate reference, flattened, omitted, unsupported, and source-only preservation.
- Users MUST be able to filter affected objects and highlight them in the model where a view is available.
- Warnings MUST distinguish expected profile limitations from unexpected adapter failures.
- Export completion MUST provide validation results and target-tool verification state separately.
- Roundtrip status MUST never be shown unless a roundtrip test actually ran.

## Required invariants

- One warning count with no object detail.
- Visual preview hides missing properties.
- Export success despite invalid target profile.
- Wrong units fixed silently.

## Known failure modes

- Approximation remains visible after import.
- A user can identify every omitted required object.
- Sending or overwriting requires acknowledgement of material loss.

## Required evidence

- Golden report snapshots.
- Large result filtering.
- Target-tool open evidence.
- Accessibility tests for status without colour alone.

## Implementation guidance

- Use a summary with severity and a detailed object table.
- Provide recommended next actions per class.
- Keep original source available for comparison.

## Open decisions

- Threshold for blocking export versus allowing with acknowledgement.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

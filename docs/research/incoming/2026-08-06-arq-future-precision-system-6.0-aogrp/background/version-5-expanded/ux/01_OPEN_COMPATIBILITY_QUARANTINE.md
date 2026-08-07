# Open, compatibility, and quarantine UX

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

The open flow must tell users what ARQ knows, what it does not know, and what mode is safe before workspace hydration.

## Normative requirements

- The first visible state MUST identify the file name, size, detected container, preflight result, and whether the source remains untouched.
- The UI MUST distinguish Editable, Read-only preserving, Reference-only, Needs migration, Needs repair, Unsupported, Corrupt, Quarantined, and Resource-limit exceeded.
- Required and optional capabilities MUST be listed in user language with technical details available on demand.
- The UI MUST not use a green success state merely because SQLite opened or the application ID matched.
- External references, executable extensions, and network resolution MUST remain disabled during quarantine.
- Every blocked state MUST offer only safe actions, such as inspect details, preserve source, open a copy, choose another reader, or export a support report.

## Required invariants

- Compatibility banner hidden after open.
- Migration presented as routine save.
- Unsupported capability name without explanation.
- Repair button overwrites source.
- Mobile file picker loses source context.

## Known failure modes

- The user always knows whether the original file changed.
- Read-only mode cannot accidentally enable save over source.
- Quarantine never resolves external content automatically.

## Required evidence

- Usability tests for each state.
- Screen-reader labels and focus order.
- Mobile Safari acquisition and return-flow tests.
- Negative test that source bytes remain unchanged.

## Implementation guidance

- Use a concise verdict card followed by expandable technical evidence.
- Show exact reader requirement and capability owner.
- Provide a copyable support fingerprint.

## Open decisions

- Final governed wording through the ARQ Language System.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

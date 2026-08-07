# Normative error codes and diagnostics

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Stable diagnostic codes allow UI, tests, MCP clients, logs, and support tools to act without parsing English exception text.

## Normative requirements

- Every contract-level failure MUST return a stable namespaced code, severity, state, affected scope, safe user message, technical detail reference, and recovery actions.
- Codes MUST be versioned and never silently reused for a different meaning.
- Diagnostics MUST distinguish corrupt, unsupported, incompatible, quarantined, stale, ambiguous, invalid, permission-denied, resource-limit, cancelled, and internal-error states.
- Internal stack traces and private paths MUST not appear in user or MCP output by default.
- Multiple diagnostics MUST preserve deterministic ordering or explicit dependency order.

## Required invariants

- Generic unknown error.
- Same code for corruption and unsupported feature.
- Sensitive path leak.
- Warning ignored during publication.
- Non-deterministic diagnostic ordering.

## Known failure modes

- Error text can be translated without changing code semantics.
- Warnings never silently downgrade a required failure.
- Recovery action cannot imply success before validation.

## Required evidence

- Golden diagnostic fixtures.
- Localization tests.
- MCP structured-output tests.
- Redaction tests.
- UI mapping completeness test.

## Implementation guidance

- Allocate code ranges through repository governance.
- Keep codes aligned with state machine transitions.
- Include a support fingerprint based on non-sensitive build and diagnostic data.

## Open decisions

- Public versus internal code registry.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

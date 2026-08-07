# Conformance profiles

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Profiles provide testable capability boundaries. Initial profiles are intentionally narrow and cumulative only where stated.

## Normative requirements

- Core Reader MUST preflight, inspect identity, report capabilities, validate core schema, and open supported files read-only without mutation.
- Core Publisher MUST create a separate portable candidate, fresh-reopen it, verify roots and assets, and preserve prior valid files on failure.
- Core Editor MUST apply typed operations atomically and create immutable revisions and grouped undo.
- Architecture Domain MUST support the protected residential plan workflow defined by repository authority, not the future domains in this proposal.
- MCP Proposal MUST expose scoped resources and proposal tools without model-controlled commit.
- Interchange profiles MUST be named per format edition and mapping profile.
- Federation profile MUST resolve pinned children and detect cycles and missing required references.

## Required invariants

- Profile name used without version.
- Optional capability accidentally required.
- Test suite skips negative cases.
- Vendor-specific behaviour presented as core standard.

## Known failure modes

- Every profile has positive and negative fixtures.
- A higher profile does not excuse failure of lower required profiles.
- Certification records exact implementation and test-suite revisions.

## Required evidence

- Machine-readable conformance report.
- Independent implementation result.
- Public limitations and unsupported cases.
- Regression results on every format-affecting release.

## Implementation guidance

- Launch only Core Reader and Core Publisher conformance first.
- Delay broad format badges until real corpora and target-tool checks exist.

## Open decisions

- Certification governance.
- Profile deprecation and long-term support.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

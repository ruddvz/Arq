# Scope and conformance

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

This document defines the candidate boundaries of `.arq` conformance. Conformance applies to named reader, writer, publisher, migrator, repairer, extension, interchange, collaboration, and MCP profiles. A product must never claim generic `.arq` support without naming the profile and version.

## Normative requirements

- A conformance claim MUST name the specification revision, profile, supported required capabilities, optional capabilities, platforms, and test-suite revision.
- A reader MUST preflight identity, limits, capabilities, schema support, and integrity before hydrating the editable workspace.
- A writer MUST NOT discard unknown required capability data. It MUST refuse write access when preservation cannot be proved.
- A publisher MUST create and validate a separate candidate and MUST NOT mutate the user’s only source publication in place.
- An extension MUST use a registered namespace and MUST declare ownership, version, dependencies, preservation rules, and canonical contribution.
- An interchange adapter MUST name exact source and target editions and produce an object-level fidelity report.

## Required invariants

- Generic “compatible” labels that omit the profile.
- Writers that open newer files and silently strip unknown data.
- Tests that cover only healthy files.
- Conformance badges based only on self-attestation.

## Known failure modes

- Conformance is profile-specific and evidence-backed.
- Read compatibility does not imply write compatibility.
- Parser success does not imply semantic, geometric, or roundtrip fidelity.
- Unknown required data can never be silently ignored.

## Required evidence

- Independent fixture suite results.
- Negative-test results for unsupported capabilities and damaged files.
- Exact reader and writer build identifiers.
- Published conformance report with limitations.

## Implementation guidance

- Start with Core Read, Core Publish, and Architecture Domain profiles.
- Add Mechanical, Federation, MCP Proposal, and Interchange profiles only after separate acceptance.
- Maintain a public capability registry and retired-profile policy.

## Open decisions

- Whether ARQ will operate an independent certification programme.
- How long old writer profiles remain supported.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

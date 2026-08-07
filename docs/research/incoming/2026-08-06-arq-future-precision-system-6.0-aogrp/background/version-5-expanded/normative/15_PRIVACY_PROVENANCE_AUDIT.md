# Privacy, provenance, and audit

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

ARQ projects can contain private designs, locations, client data, intellectual property, external assets, AI prompts, and professional analyses. Provenance must support trust without collecting unnecessary sensitive content.

## Normative requirements

- Every consequential operation MUST record actor class, stable actor reference, tool or client, source revision, operation schemas, and approval path.
- AI provenance MUST record model/provider identifier where available, agent version, proposal digest, prompt reference or redacted summary, tool inputs, assumptions, and exact committed operations.
- Raw prompts, file paths, tokens, and personal data MUST NOT be logged by default merely for audit completeness.
- Support bundles MUST be opt-in, previewable, scoped, and recursively redacted.
- Cloud computation MUST declare data sent, purpose, provider, retention, region where relevant, and resulting evidence.
- Audit records MUST be tamper-evident at the revision layer but may use privacy-preserving references to separately controlled logs.

## Required invariants

- Prompt contains secret.
- Imported project contains personal addresses.
- Support bundle includes assets.
- Audit link points to deleted external log.
- Cloud analysis retention unknown.

## Known failure modes

- Provenance explains origin; it does not certify correctness.
- More logging is not automatically safer.
- A user can inspect what leaves the device before consent.

## Required evidence

- Data-flow tests.
- Network observation for named workflows.
- Redaction fixtures.
- Retention and deletion tests.
- Audit reconstruction for selected revisions.

## Implementation guidance

- Classify data by project and operation.
- Store small durable provenance in `.arq` and large private traces outside with controlled references.
- Make cloud usage a reviewed operation.

## Open decisions

- Default AI prompt retention.
- Audit signature and external transparency log policy.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

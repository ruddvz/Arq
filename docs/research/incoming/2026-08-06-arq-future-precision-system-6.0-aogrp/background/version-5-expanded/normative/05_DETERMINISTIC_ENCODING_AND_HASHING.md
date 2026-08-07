# Deterministic encoding and hashing

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Deterministic encoding supports revision identity, deduplication, signatures, replication, and independent conformance. It must not depend on JSON whitespace, SQLite row order, floating-point formatting, or map insertion order.

## Normative requirements

- The candidate canonical payload encoding is deterministic CBOR following RFC 8949 deterministic encoding requirements plus ARQ-specific restrictions.
- Canonical maps MUST use deterministic key ordering and MUST reject duplicate keys.
- Indefinite-length items and non-preferred integer encodings MUST be rejected at the canonical boundary.
- Uncontrolled floating-point values MUST NOT appear in canonical identity-bearing payloads.
- Text MUST use valid UTF-8 and repository-approved Unicode normalisation for identity-bearing fields.
- Every digest MUST use domain separation, versioned preimage format, and explicit length framing.
- Revision roots MUST be independent of SQLite page layout, row IDs, indexes, caches, thumbnails, timestamps, and branch labels.
- File-byte hashes MUST be recorded outside any self-referential file field or use a defined detached-signature process.

## Required invariants

- JSON number divergence.
- Unicode confusables in registry IDs.
- Hash cycles.
- Unordered relation sets.
- Schema changes without digest-version changes.
- Length-extension mistakes with naive concatenation.

## Known failure modes

- Same canonical semantic content produces the same digest in independent conforming implementations.
- Different domains cannot reuse the same raw preimage without distinct domain tags.
- Changing derived caches does not change the semantic revision root.

## Required evidence

- Golden encoding vectors.
- Two independent implementations in different languages.
- Mutation tests for ordering, whitespace, caches, and metadata.
- Collision-domain review and cryptographic test vectors.

## Implementation guidance

- Use SHA-256 initially unless repository security governance chooses another approved digest.
- Version every preimage format.
- Provide a human-readable canonical JSON projection for inspection, not primary identity.

## Open decisions

- Canonical Unicode policy.
- Whether signatures are part of initial scope or deferred.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

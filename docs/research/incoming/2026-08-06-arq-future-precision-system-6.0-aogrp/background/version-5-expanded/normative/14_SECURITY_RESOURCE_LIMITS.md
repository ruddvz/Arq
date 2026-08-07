# Security and resource limits

**Status:** Proposed candidate specification. Not accepted, implemented, verified, or released.

## Purpose

Untrusted `.arq` files, imports, assets, extensions, and references must be handled as hostile until bounded preflight and policy allow deeper use.

## Normative requirements

- Preflight MUST disable SQLite extension loading, network access, external reference resolution, and executable extension activation.
- Readers MUST enforce configurable maximum file bytes, pages, rows, components, relations, operation count, nesting, string length, blob length, asset count, decompressed bytes, geometry entities, solver time, and memory.
- Queries MUST be application-owned and parameterised. Raw SQL from a file, model, extension, or user prompt MUST NOT execute.
- External paths MUST be normalised, sandboxed, and prevented from escaping allowed roots. Symlinks and archives require separate policy.
- Asset type must be checked by magic and decoder, not file extension alone.
- All parser, kernel, and solver diagnostics exposed to MCP or support bundles MUST be recursively redacted for secrets and private paths.
- Executable extensions require explicit installation, trust, permissions, version pinning, and revocation outside the file itself.

## Required invariants

- Zip bomb.
- SQLite page bomb.
- Path traversal.
- Prompt injection in metadata.
- Malicious SVG or image.
- Kernel denial of service.
- Token in external URL.
- Extension supply-chain compromise.

## Known failure modes

- A file cannot grant itself permissions.
- Imported text cannot change system instructions.
- Resource exhaustion is a correctness failure, not only performance.
- Quarantine preserves evidence without activating content.

## Required evidence

- Fuzzing corpus and timeouts.
- Dependency and secret scans.
- Sandbox negative tests.
- Recursive redaction fixtures.
- MCP grant and token misuse tests.

## Implementation guidance

- Use isolated workers or processes for risky parsers and geometry operations.
- Fail closed on limit ambiguity.
- Publish default limits and allow controlled project-specific increases.

## Open decisions

- Browser sandbox architecture.
- Native desktop isolation if introduced.

## Non-claims

This document does not prove current repository behaviour, production compatibility, lossless interchange, geometry correctness, security, performance, or release readiness. Those states require revision-bound implementation and executed evidence.

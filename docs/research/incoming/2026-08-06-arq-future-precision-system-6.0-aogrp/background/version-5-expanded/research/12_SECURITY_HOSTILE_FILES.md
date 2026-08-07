# Hostile-file and supply-chain research

**Status:** Research and proposal input. External sources do not establish current ARQ implementation truth.

## Scope

The threat model covers untrusted `.arq`, SQLite, archives, imported CAD/BIM, external references, assets, extension packages, MCP resources, and generated metadata.

## Verified source observations

- Application files can trigger resource exhaustion through extreme row counts, nested structures, oversized blobs, pathological geometry, huge coordinate ranges, decompression, or expensive validation.
- SQLite supports features such as extensions and pragmas that an application should constrain. Read-only and defensive configurations reduce attack surface but do not replace sandboxing and input limits.
- External references can become confused-deputy paths, credential leaks, path traversal vectors, or prompt-injection sources.
- Native geometry kernels, image codecs, PDF libraries, and proprietary SDKs expand supply-chain and memory-safety exposure.

## Lessons for `.arq`

- Open untrusted files first in a bounded preflight process with no network, no extension loading, no external reference resolution, and strict time and memory limits.
- Quarantine unknown executable extensions and active content. Preserve bytes only when policy allows.
- Use content-addressed assets, safe path handling, MIME and magic checks, recursive redaction, dependency pinning, SBOMs, and fuzz corpora.
- MCP-visible metadata from files must be treated as untrusted content and cannot change system instructions or permissions.

## Gaps ARQ can address

- ARQ can make quarantine and source-preservation states visible rather than silently dropping or executing data.
- ARQ can record exactly which parsers and versions touched a project.
- ARQ can provide a safe support bundle that is opt-in, scoped, and recursively redacted.

## Primary sources consulted

- SQLite limits, EXT-SQLITE-LIMITS.
- MCP authorization and security guidance, EXT-MCP-AUTH and EXT-MCP-SPEC.
- ARQ Project source 11_SECURITY_PRIVACY_DATA_AND_SUPPLY_CHAIN.md.

## Limits

- No external fuzz corpus or native parser was executed.
- Security is a continuing process, not a one-time package property.

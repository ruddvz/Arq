# Encoding decision research

Deterministic CBOR is a strong candidate for canonical identity because RFC 8949 defines deterministic restrictions and the format is self-describing. Cap'n Proto and FlatBuffers are strong candidates for hot-path or zero-copy projections because they support schema evolution and direct buffer access. They are not automatically suitable for canonical identity.

Decision proposal:

- Deterministic CBOR for canonical object payloads after cross-language bakeoff.
- FlatBuffers or Cap'n Proto only for derived indexes, geometry worker messages, or render packets if benchmarks justify them.
- Human-readable canonical JSON projection for diagnostics.
- No raw Rust memory archive as a long-term public format without a language-neutral specification and independent implementation.

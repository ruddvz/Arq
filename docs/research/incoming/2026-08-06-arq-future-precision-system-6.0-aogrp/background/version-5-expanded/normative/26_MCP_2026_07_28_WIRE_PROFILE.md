# MCP 2026-07-28 wire profile

The primary remote profile uses Streamable HTTP and protocol revision 2026-07-28. Every request validates protocol version, method headers, optional tool-name header, JSON-RPC method, client identity metadata, audience, authorization issuer, grant, project, and revision. Hidden transport sessions are forbidden as the sole location of proposal state. `server/discover` returns stable deterministic catalogs with bounded cache hints. Legacy protocol support is an adapter with separate tests.

## Mandatory evidence

A production claim requires repository tests, revision-bound artefacts, and failure-path verification. Package-local demonstrations are informative only.

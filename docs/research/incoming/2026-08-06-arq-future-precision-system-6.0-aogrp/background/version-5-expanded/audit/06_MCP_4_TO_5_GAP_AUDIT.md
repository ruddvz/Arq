# MCP gap audit

Version 4’s domain proposal service remains useful, but its protocol description was built around the previous MCP lifecycle.

## Required changes for 2026-07-28

- Remove assumptions that protocol sessions preserve proposal state.
- Put protocol version, client identity, and capabilities in each request metadata object.
- Support optional `server/discover`.
- Validate `Mcp-Method` and `Mcp-Name` headers against JSON-RPC content.
- Use explicit proposal, task, upload, and review handles for application state.
- Use MRTR for mid-call user input when the client supports it.
- Use the Tasks extension for bounded long-running analysis.
- Treat Roots, Sampling, Logging, and legacy HTTP+SSE as deprecated for new work.
- Validate authorization issuer binding and client metadata.
- Make TypeScript SDK protocol selection explicit.

The reference parser tests only the ARQ boundary conditions. It is not a full MCP conformance implementation.

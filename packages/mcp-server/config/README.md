# Client configuration

The server is a real, launchable process. Build it once:

```bash
pnpm --filter @arq/mcp-server build
```

That produces `packages/mcp-server/dist/arq-mcp-stdio.mjs`, a single Node
module with no resolution setup, which is what the templates here launch.
`pnpm benchmark:mcp-protocol` spawns exactly that bundle and drives a real
JSON-RPC session against it, so the thing these templates point at is
covered by a check rather than by hope.

## The grant file

The server carries no authority of its own. `ARQ_MCP_GRANT_FILE` names a
JSON file describing what the operator shared:

```json
{
  "grantId": "grant-2026-08-01-a",
  "subjectId": "subject-you",
  "tenantId": "tenant-you",
  "preset": "plan",
  "scopes": ["arq.capabilities.read"],
  "projectIds": ["project-local"],
  "issuedAtEpochMs": 1767225600000,
  "lifetimeMs": 3600000
}
```

Four things follow from reading it per call rather than at connect time:

- **No file means nothing is shared.** Every tool answers so. That is the
  correct default, not a fault, and it is what an unconfigured client gets.
- **Deleting the file withdraws access on the next call**, with no
  reconnection. The capability check proves this by deleting it mid-session.
- **A malformed file is treated as no grant**, with a line on standard
  error. It never falls back to something permissive.
- **The client's identity is not taken from the file.** The file says what
  was shared; the `initialize` handshake says who turned up. That is why an
  assistant cannot describe itself as a person in the provenance of a plan
  it wrote.

`preset` is `read_only`, `plan` or `propose` and replaces `scopes` when
present. The presets are strictly nested, so raising one only ever adds.

## Local, over stdio

- [`claude-code.mcp.json`](claude-code.mcp.json)
- [`cursor.mcp.json`](cursor.mcp.json)
- [`codex.config.toml`](codex.config.toml)

Claude Code, Cursor, Codex CLI, Codex IDE and the ChatGPT desktop app can
all launch a local server. That is the right transport for this boundary:
the project never leaves the machine, and the grant is written by the
application the operator is already looking at.

These are starting points, not evidence of support. No client run has been
recorded, and support is claimed for one named client and version at a time
after one has been - see delivery phase 4 in
`docs/ai/MCP-SYSTEM-3.0-PLAN.md`.

## What the local server actually holds

The bundled entry uses the in-process semantic host: real levels, wall
types, walls, openings, rooms and dimensions, validated by
`@arq/validation` and `@arq/operations`, held in memory. It writes no file,
and every snapshot says so. `ARQ_MCP_SEED_PROJECT=<name>` seeds one project
with a ground floor and a wall type so a connected client has something to
read.

A desktop shell would pass its own `ArqProjectHost` and keep
`ArqOperatorSurface` - the object that can commit - to itself.

## Remote, over HTTPS

A hosted client cannot launch a local process, so it needs a remote
endpoint. That is an architecture project rather than a configuration
change - an authorization server, token audience and resource checks,
tenant isolation, grant issuing and revocation, retention, abuse controls
and kill switches - and none of it exists. `arq_get_capabilities` reports
`remote_gateway` as unavailable for exactly that reason.

[`remote-http.mcp.json`](remote-http.mcp.json) records the shape so the work
is not rediscovered later. It is not an endpoint.

## The loopback endpoint

`transport/http-guard.ts` implements the guards for a paired loopback HTTP
endpoint: a bearer pairing token compared in constant time, a Host check
that refuses `localhost` (whose resolution can be redirected), an Origin
check, a content-type check that a cross-site form cannot satisfy, and a
body-size ceiling. An unpaired endpoint refuses every request rather than
defaulting to open.

# Client configuration templates

These are starting points, not evidence. None of them has been run against a
real client: `docs/ai/MCP-SYSTEM-3.0-PLAN.md` records client acceptance as
delivery phase 4, and support is claimed for one named client and version at a
time after a recorded run.

Two things have to exist before any of these work, and neither is in this
repository yet:

1. **A launchable server.** `@arq/mcp-server` ships as TypeScript source, like
   every other package in this workspace. The Arq application bundles it; there
   is no standalone executable to point a `command` at until the desktop shell
   builds one.
2. **A grant.** The server has no default grant. Until Arq has a pairing and
   sharing surface that mints one, every tool answers "nothing is shared with
   this connection", which is the correct answer and not a useful session.

The command in each template is therefore written as the path the Arq
application will publish, and is marked as such.

## Local, over stdio

Claude Code, Cursor, Codex CLI, Codex IDE and the ChatGPT desktop app can all
launch a local server over stdio when Arq is on the same machine. That is the
right transport for this boundary: the project never leaves the machine, and the
grant is issued by the application the operator is already looking at.

- [`claude-code.mcp.json`](claude-code.mcp.json)
- [`cursor.mcp.json`](cursor.mcp.json)
- [`codex.config.toml`](codex.config.toml)

## Remote, over HTTPS

A hosted client cannot launch a local process, so it needs a remote endpoint.
That is an architecture project rather than a configuration change - an
authorization server, token audience and resource checks, tenant isolation,
grant issuing and revocation, retention, abuse controls and kill switches - and
none of it exists. `arq_get_capabilities` reports `remote_gateway` as
unavailable for exactly this reason.

[`remote-http.mcp.json`](remote-http.mcp.json) records the shape so that the
work is not rediscovered later. Do not treat it as an endpoint.

## The loopback endpoint

`transport/http-guard.ts` implements a paired loopback HTTP endpoint for local
protocol testing. It requires a bearer pairing token that Arq generates and
shows to the operator, and it refuses any Host other than the loopback address
it bound to - including `localhost`, whose resolution can be redirected. An
unpaired endpoint refuses every request rather than defaulting to open.

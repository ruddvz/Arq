# AI, MCP, and precision authoring research

## Current protocol

MCP 2026-07-28 is the current stable protocol as of August 6, 2026. It replaces the protocol-level session and initialize handshake with self-describing requests. Clients may call `server/discover`, but discovery is optional. Streamable HTTP requests carry routing information in `Mcp-Method` and `Mcp-Name`. Client identity and capabilities travel in request metadata.

ARQ must not confuse stateless transport with stateless design work. Long-lived application state remains explicit through project revisions, proposal IDs, task IDs, upload handles, review records, and grants.

## ARQ tool design

Tools should be narrow and stage consequential work:

- `arq.project.inspect`
- `arq.selection.describe`
- `arq.proposal.begin`
- `arq.proposal.add_operations`
- `arq.proposal.validate`
- `arq.proposal.preview`
- `arq.proposal.submit_review`
- `arq.analysis.request`
- `arq.interchange.preflight`
- `arq.task.get`

The model never receives raw SQL or a generic “execute operation” bypass.

## MRTR and tasks

Use Multi Round-Trip Requests when a tool needs user input before it can finish, such as selecting between ambiguous faces or accepting an approximation policy. Use the Tasks extension for long-running but bounded analysis, import, export, migration, or geometry regeneration. The task result still returns a proposal or evidence record. It does not silently commit.

## Compatibility

Some clients and SDK configurations still speak 2025-11-25. ARQ should inventory actual clients before deciding whether to ship a compatibility adapter. Compatibility logic must remain outside the canonical domain service and must have a removal plan.

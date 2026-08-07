# MCP server implementation plan

## Target

Use MCP `2026-07-28` as the primary protocol. Do not infer wire support from an SDK package version alone. The official TypeScript v2 guidance requires explicit opt-in for the new revision.

## Layers

1. **ARQ domain service:** grants, revision-pinned reads, proposal state, operation validation, previews, review records, task evidence, and host commit.
2. **2026 protocol adapter:** stateless request validation, discovery, routing headers, `_meta`, authorization, MRTR, Tasks, resources, and tools.
3. **Optional legacy adapter:** 2025-11-25 compatibility for named clients only.
4. **Host integration:** identity, consent, data disclosure, Review Centre, approval, audit, and canonical operation commit.

Protocol adapters cannot change domain rules.

## Resource design

- `arq://project/{projectId}/revision/{revisionRoot}/summary`
- `arq://project/{projectId}/revision/{revisionRoot}/objects/{objectId}`
- `arq://project/{projectId}/revision/{revisionRoot}/constraints`
- `arq://project/{projectId}/revision/{revisionRoot}/diagnostics`
- `arq://proposal/{proposalId}`
- `arq://task/{taskId}`
- `arq://interchange-report/{reportId}`

Every project resource is bounded, typed, permission-checked, and revision-pinned. Live pointers cannot authorize a commit.

## Initial tools

- `arq.project.inspect`
- `arq.selection.describe`
- `arq.proposal.begin`
- `arq.proposal.add_operations`
- `arq.proposal.validate`
- `arq.proposal.preview`
- `arq.proposal.submit_review`
- `arq.analysis.request`
- `arq.interchange.preflight`
- `arq.task.cancel`

There is no model-callable `commit`, `approve`, raw SQL, generic filesystem write, unrestricted shell, deployment, or repository mutation tool.

## Explicit application state

Since the protocol core is stateless, use proposal IDs, task IDs, pagination cursors, upload IDs, review IDs, and grants. Each handle is bound to subject, client, audience, project, revision, expiry, and nonce. Handles are not bearer authority by themselves.

## MRTR

Use MRTR for missing input that is necessary to continue, such as selecting between ambiguous semantic targets or choosing an import approximation. The request must show choices and consequences. Consequential approval remains a Review Centre action.

## Tasks

Use the Tasks extension for bounded geometry regeneration, import, export, migration, simulation, or city indexing. Persist task inputs, versions, budget, state, cancellation, outputs, and evidence. Tasks cannot mutate canonical state directly.

## Required negative tests

- Unsupported protocol revision.
- Missing or mismatched routing headers.
- Missing client identity metadata.
- Wrong issuer, audience, subject, project, revision, scope, operation type, object scope, expiry, or nonce.
- Proposal changed after approval.
- Approval replay.
- Stale base revision.
- Prompt injection inside project data.
- Task access across authorization contexts.
- Tool schema depth and payload limit.
- Attempted raw SQL, external write, or permission enlargement.

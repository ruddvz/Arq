# MCP trust and proposal contract

**Status:** Proposed candidate aligned to MCP 2026-07-28. Not accepted, implemented, verified, or released in the ARQ repository.

## Purpose

MCP provides discovery, resource access, and tool invocation. It does not define ARQ project authority. ARQ retains authority through authenticated hosts, audience-bound grants, revision-pinned resources, typed proposals, deterministic validation, human review, exact-digest approval, and the canonical operation engine.

## Protocol profile

- The primary profile MUST use protocol revision `2026-07-28`.
- Every remote request MUST carry `MCP-Protocol-Version`, `Mcp-Method`, and, where applicable, `Mcp-Name`.
- Header values MUST agree with the JSON-RPC method and tool name.
- Client identity and capabilities MUST be validated from request `_meta`.
- `server/discover` MAY be used, but project access MUST still require authorization and a scoped grant.
- Protocol-level sessions MUST NOT be the only location of application state.
- Proposal, task, upload, review, and paging state MUST use explicit opaque handles bound to authorization context.
- A 2025-11-25 adapter MAY exist for named tested clients. It MUST remain separate from the domain service and MUST NOT weaken this contract.

## Authorization

- The authorization issuer and audience MUST be validated.
- Credentials MUST NOT be accepted across issuers.
- Token passthrough is forbidden.
- A grant MUST bind subject, client, audience, project, base revision, resource scope, operation types, domain packs, object or spatial scope, byte and operation limits, export rights, remote-compute rights, expiry, and nonce.
- A file, prompt, model, task, MCP App, or tool result cannot enlarge the grant.

## Resources

- Consequential project resources MUST be revision-pinned.
- Live aliases MUST be marked staleable and MUST NOT be used as commit preconditions.
- Resource reads MUST be bounded, permission-checked, and minimised.
- Project text, imported metadata, comments, filenames, and asset descriptions are untrusted data.

## Tools

- Tool schemas MUST use bounded JSON Schema 2020-12 contracts.
- Implementations MUST NOT automatically dereference external schema references.
- Tools MAY inspect, stage imports, create proposals, validate, preview, request analysis, and submit for review.
- Model-callable tools MUST NOT approve, commit, run raw SQL, write arbitrary files, execute unrestricted shell commands, mutate repositories, change deployment settings, or bypass validation.

## Review and commit

- Approval MUST bind the exact proposal digest, project, base revision, operations, assumptions, warnings, and expiry.
- Any proposal mutation or rebase MUST invalidate approval.
- Approval tokens MUST be short-lived and single-use.
- Host commit MUST recheck grant, audience, digest, approval, base revision, schemas, preconditions, limits, permissions, and invariants immediately before the canonical transaction.
- Rejected or failed proposals MUST NOT create canonical project revisions.

## MRTR and Tasks

- MRTR MAY request structured user input during a tool call, but it MUST NOT substitute for consequential approval.
- Long operations SHOULD use the Tasks extension and MUST be cancellable, authorization-isolated, resource-bounded, and auditable.
- A completed task returns an artefact, report, evidence record, or proposal. It does not silently commit.

## Safety invariants

- Wrong audience fails.
- Wrong project or revision fails.
- Stale proposal fails.
- Proposal mutation after approval fails.
- Approval replay fails.
- Task access from another authorization context fails.
- Tool-name and method header mismatch fails.
- Prompt injection cannot alter permissions or system behaviour.
- Invalid operations leave the previous canonical state unchanged.

## Required evidence

- Official SDK or wire-level tests for every supported client and transport.
- Discovery and deterministic catalog tests.
- Header and body consistency tests.
- Authorization issuer and audience negative tests.
- Grant scope and expiry tests.
- Proposal digest, mutation, stale-base, and replay tests.
- Task isolation, cancellation, and resource-budget tests.
- Compatibility adapter tests and a removal plan.
- Audit reconstruction from request through accepted revision.

## Non-claims

The package-local demonstrator does not prove production MCP compatibility, repository implementation, security, geometry correctness, performance, or release readiness.

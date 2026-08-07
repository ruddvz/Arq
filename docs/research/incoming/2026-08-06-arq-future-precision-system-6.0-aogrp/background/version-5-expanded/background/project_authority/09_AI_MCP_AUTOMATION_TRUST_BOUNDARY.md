---
source_id: ARQ-OS3-AI-MCP-BOUNDARY
source_type: trust-boundary-bridge
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ AI and core owners
repository_authority: packages/mcp-server and accepted ADRs
---

# AI, MCP, and automation trust boundary

## Current observed state

The repository contains an MCP boundary with scoped grants, typed operations from existing ARQ constructors, project validation, and tests. It is library-complete at the observed commit but not reachable from the product, has no web host or Review Centre surface, and has no recorded client run.

## Authority rule

This Project may prepare tasks and inspect evidence. It must not create a parallel MCP schema or claim that a repository library is a released product capability.

## Minimum operation lifecycle

1. Identify authenticated actor and scoped, expiring, revocable grant.
2. Pin project ID and base revision.
3. Parse request as untrusted input.
4. Produce explicit assumptions and typed operation proposal.
5. Show affected elements and consequences.
6. Run permission, schema, semantic, geometry, and project-state validation.
7. Detect stale base revision.
8. Present preview and diff.
9. Require explicit approval for consequential edits.
10. Commit through normal operation boundaries.
11. Record provenance and result.
12. Support grouped undo.
13. Leave canonical state unchanged on failure or cancellation.

## Forbidden capabilities without an accepted decision

- hidden direct model mutation;
- arbitrary project paths or raw query languages exposed to the client;
- a tool that approves its own proposal;
- bypass of grants, permissions, validation, or undo;
- silent migration or format conversion;
- professional, code, structural, or safety approval;
- secret retrieval;
- uncontrolled external network access;
- production deployment or repository merge through a model prompt alone.

## Host and UX acceptance before release

- client authentication and grant lifecycle;
- host transport and origin policy;
- reconnect, timeout, duplicate, replay, cancellation, and revocation behaviour;
- Review Centre UI with assumptions, proposal, revision, validation, preview, approval, commit, failure, and undo;
- audit event and privacy policy;
- project-data minimisation;
- malicious payload and prompt-injection tests;
- current-head client run recorded as evidence;
- negative tests proving unavailable tools remain unavailable.

## External automation

GitHub, Vercel, email, issue trackers, and other connectors are separate authority domains. An AI task may prepare an action. External mutation requires the user's requested action, connector scope, deterministic preconditions, and a clear rollback or compensation path.

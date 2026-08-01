# ADR-0027: The MCP boundary and domain profiles

**Status:** Proposed
**Date:** 2026-08-01
**Owners:** To assign (architecture owner, security reviewer, release owner)
**Decision:** An AI client reaches Arq only through a governed MCP boundary that
can read, plan and propose. It can never commit, approve, name a path or write a
file. What it may propose is bounded by registered domain profiles.

## Context

ADR-0014 decided that AI creates previewable typed operations through ArqScript,
and `@arq/arqscript` implements that grammar. ADR-0005 established typed
operations; ADR-0002 established a plan-first semantic building model. What none
of them settled is the boundary an external AI client crosses to reach any of
it: which process holds the model, who decides what a client may see, what a
"proposal" is as a durable object, and what happens when someone asks for
something outside architecture entirely.

Two reference packages were supplied for review (`ARQ_MCP_SYSTEM_1.0` and
`ARQ_MCP_SYSTEM_2.0`). Their safety instincts were right: no raw file writing,
no database access, no model-controlled approval, no single broad execute tool.
Their limitation was that they were written without the repository, so
everything real was a fixture, and the domain-profile system at the centre of
their architecture existed only in prose. `docs/ai/MCP-SYSTEM-3.0-PLAN.md`
records the full defect register.

The question this ADR settles is the shape of the boundary, not whether to have
one.

## Options

**A. No external AI boundary.** AI assistance stays inside the Arq application,
driving ArqScript directly. Smallest attack surface. It also means the tools
people already use - Claude Code, Cursor, Codex, ChatGPT - cannot help with an
Arq project at all, and the pressure to work around that lands on file access,
which is the outcome with the worst properties.

**B. A general-purpose bridge.** Expose the semantic model and a generic
mutation API, and let the client compose. Fastest to build, and it removes every
question this ADR exists to answer: what an operation means, what it
invalidates, who approves it, how it is undone. It also lets an assistant write
geometry that satisfies a schema and means nothing.

**C. A governed proposal boundary with registered domain profiles.** The client
reads bounded context, writes non-executable plans, and proposes typed
operations from a published catalogue. Arq validates, the operator decides in
Arq, and Arq commits. New domains arrive as profiles with their own model
extension, operations, validators, file impact and evidence.

## Decision

Option C.

1. **The boundary is a package in this repository**, `@arq/mcp-server`, wired to
   `@arq/bim-core`, `@arq/operations`, `@arq/validation` and `@arq/arqscript`.
   It does not define a second semantic model or a second operation catalogue.

2. **Commit is not reachable from the boundary.** `ArqProjectHost` can read and
   validate. `ArqOperatorSurface` can apply, undo, change access state and mark
   published, and the MCP server is never constructed with it. The guarantee is
   that the object is out of scope, not that a flag is unset.

3. **Every call carries a grant.** `GrantContext` names the subject, the tenant,
   the client, the scopes and the exact projects. It expires, it can be revoked,
   and it is checked on every call. A project outside the grant and a project
   that does not exist produce the same error.

4. **The catalogue is derived, not authored.** Operation types come from
   `@arq/arqscript`'s constructors; derived-output names come from
   `@arq/bim-core`'s invalidation constants; the catalogue revision is a content
   digest of what is registered.

5. **Planning is unrestricted; execution is not.** A design program may describe
   any domain. Only a registered profile contributes operations a change set may
   name. An unregistered domain returns the profile that would own the work, the
   operations it would need, and its blockers.

6. **A new domain profile needs its own ADR.** The profile contract - model
   extension, operations, validators, derived outputs, file impact, import and
   export, UX, security, evidence - is the checklist.

7. **Zero new runtime dependencies.** The protocol, the schema layer and the
   transports are implemented here.

## Consequences

**Technical.** The semantic model stays canonical and single. A rejected
proposal cannot change project state, because validation and application run the
same code over a candidate that is only swapped in on success. Adding an
operation means adding a catalogue entry with an argument contract, an approval
class, allowed project states, invalidations and evidence - which is more work
than adding a function, deliberately.

**Product.** Arq can honestly say an assistant may describe anything and build
only what Arq has registered. A request outside architecture produces a
specification and a named backlog rather than a refusal or a fabrication.

**Operational and licence.** No new dependency, so no licence or SBOM change.
The audit trail stores request fingerprints rather than content, which keeps the
retention question small; where plans themselves live is deferred to the ADR
that introduces the application bridge.

**If this decision changes.** The boundary is one package with no consumers
inside the product yet. Removing it removes a package. Widening it - a commit
tool, a path argument, a generic mutation - would invalidate the guarantees
above and needs its own ADR, not an amendment to this one.

## Validation

- `pnpm typecheck`, `pnpm lint` and `pnpm test` cover the package; 256 tests at
  the time of writing, including a full client journey from capabilities to a
  queued proposal.
- Structural assertions rather than review: the tool table and the scope table
  must be equal in both directions; every declared proposal state must be
  reachable; the advertised limits must equal the enforced ones; an ungranted
  project and a nonexistent one must produce identical errors.
- Fourteen hostile reference URIs that the reviewed 2.0 guard accepted are
  pinned as failing.

## Rollback

Delete the package and remove it from the workspace. Nothing in the product
imports it yet. Once the application bridge exists (delivery phase 1), rollback
becomes: revoke grants, disable the server, and leave committed project
revisions untouched. Staged proposals are not project history and are discarded
without loss.

## Related issues

- ADR-0002 plan-first semantic model, ADR-0005 typed operations, ADR-0014 AI
  operation model, ADR-0016 authentication strategy, ADR-0018 analytics and
  privacy
- `docs/ai/MCP-SYSTEM-3.0-PLAN.md`, `docs/ai/AI-GUARDRAILS.md`,
  `docs/ai/SECURITY-THREAT-MODEL.md`
- `packages/mcp-server/README.md`

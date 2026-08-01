# Arq MCP System 3.0: critique of the 2.0 package, and what replaces it

**Status:** Implemented in `packages/mcp-server`, with the parts that remain
blocked named individually below.
**Date:** 2026-08-01
**Supersedes:** the review of the supplied `ARQ_MCP_SYSTEM_1.0` and
`ARQ_MCP_SYSTEM_2.0` reference packages. Those packages are not vendored into
this repository; this document records what was taken from them, what was wrong
with them, and what was built instead.

## 1. The one change that matters

Every page of the reviewed 2.0 package carries the same blocker: _"the actual
ARQ repository and runtime contracts were not supplied"_. Its adapter therefore
validated a fixture operation called `fixture.record.put` against a `Map` of
strings, its capability report said `semantic_geometry: unavailable`, and its
own integration plan warned against the thing it had been forced to do -
"do not hand-maintain a second list in TypeScript" - while shipping exactly
that.

The repository is available. So the central correction is not a better fixture:
it is that the MCP boundary now lives inside the monorepo and is wired to the
packages that already exist.

| 2.0 invented                                  | 3.0 uses                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A fixture operation catalogue of two records  | Operation types read from `@arq/arqscript`'s own constructors (ADR-0014)                            |
| A `Map<string, MockRecord>` model             | `@arq/bim-core` levels, wall types, walls, openings, rooms and dimensions                           |
| Hand-written validation of fixture arguments  | `@arq/validation` segment, polygon and identity rules, plus `@arq/operations` opening-overlap rules |
| A hard-coded `fixture-catalog-1.0.0` revision | A content digest of the registered catalogue                                                        |
| Invalidation names invented in the package    | `WALL_TYPE_DERIVED_INVALIDATIONS` and friends, read from `@arq/bim-core`                            |

Wiring the two together surfaced three genuine gaps between ArqScript v0 and the
semantic model it is supposed to produce. They are recorded on the operations
concerned in `packages/mcp-server/src/profile/architecture-operations.ts` rather
than papered over:

1. ArqScript's `create wall` has no level, and `createWall` requires a `levelId`.
2. ArqScript's wall type is a display name; the model needs an identified
   `WallType` with a thickness and a default height, and ArqScript v0 has no
   command that creates one.
3. ArqScript's `create room` supplies a boundary polygon while `Room` carries a
   calculated boundary, area and status, so the host derives them and a caller
   may not assert an area.

Those three are real findings about ArqScript v0, not about the MCP package.

## 2. Defect register

Each entry names the defect in the reviewed package, why it matters, and where
the fix lives. "Design defect" means the code did what it was written to do and
the design was wrong; "bug" means it did not.

### 2.1 Security and trust

| ID   | Kind          | Defect in 2.0                                                                        | Consequence                                                                                                                                                       | Fix                                                                                                                                                                                                                |
| ---- | ------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S-01 | Design defect | `ArqAdapter` methods took only data. No parameter carried a principal.               | Project grants, scopes, tenant isolation and revocation - all required by 2.0's own threat model - had nowhere to live, so all four were recorded as future work. | `GrantContext` is the first argument of every bridge method (`grant/grant.ts`).                                                                                                                                    |
| S-02 | Design defect | `provenance` was a tool argument.                                                    | A model could send `{ origin: "human", clientName: "Arq Desktop" }` and the record of who authored a plan would say a person did.                                 | Provenance is derived from the `initialize` handshake and the server clock (`domain/plan-common.ts`). The input schemas have no provenance field.                                                                  |
| S-03 | Design defect | `rightsStatus: "user_attests_permitted"` was model-assertable.                       | Software attesting to a person's reuse rights.                                                                                                                    | `MODEL_ASSERTABLE_RIGHTS_STATUSES` excludes it. Only the operator can record an attestation, in Arq.                                                                                                               |
| S-04 | Bug           | Reference URIs were guarded by `/^(https:\/\/\|arq:\/\/)/`.                          | `https://user:token@host`, `https://127.0.0.1/admin`, `https://169.254.169.254/`, `https:///etc/passwd` and Cyrillic homographs all passed.                       | `schema/reference-uri.ts` parses the URI, rejects credentials, non-default ports, IP literals, reserved namespaces and non-ASCII. Fourteen previously-passing hostile URIs are pinned as failing tests.            |
| S-05 | Design defect | `approveAndCommitForTest` was a public method on the adapter the tool layer held.    | The "no commit tool" guarantee rested on nobody calling a public method.                                                                                          | Commit lives on `ArqOperatorSurface`, a separate object the MCP server is never constructed with.                                                                                                                  |
| S-06 | Design defect | Cursors were `{ offset }` in base64url, unbound to any query.                        | A cursor from one query paged into another; a cursor outliving a revision silently skipped or repeated elements.                                                  | `adapter/cursor.ts` binds a fingerprint of the tool, grant, project, revision and filters.                                                                                                                         |
| S-07 | Design defect | No audit surface, while the threat model required audit events.                      | No record of what a connection did.                                                                                                                               | `audit/audit-trail.ts`, bounded, per-grant readable, storing a request fingerprint and never request content.                                                                                                      |
| S-08 | Design defect | The loopback HTTP server had no pairing token, though the threat model listed one.   | Any local process could drive the server.                                                                                                                         | `transport/http-guard.ts` requires a bearer pairing token compared in constant time, plus Host, Origin, method, path, content-type and body-size checks - all as pure functions with tests, not smoke-script-only. |
| S-09 | Design defect | `hasAllowedHost` accepted `localhost`.                                               | A resolver can be made to point `localhost` anywhere; the server binds to the loopback address.                                                                   | Only `127.0.0.1:<port>` and `[::1]:<port>` are accepted.                                                                                                                                                           |
| S-10 | Design defect | Error messages disclosed proposal state to a caller that might not own the proposal. | State as an oracle.                                                                                                                                               | `domain/errors.ts` has one non-disclosing factory per record kind. A test asserts an ungranted project and a nonexistent one produce byte-identical errors.                                                        |

### 2.2 Correctness

| ID   | Kind          | Defect in 2.0                                                                                                                                                                             | Consequence                                                                                                                                                                                                             | Fix                                                                                                                                                                      |
| ---- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-01 | Bug           | Coverage matched operation **names** only.                                                                                                                                                | A capability reported `available` when every registered version was different.                                                                                                                                          | `adapter/coverage.ts` matches name and version and reports the registered versions.                                                                                      |
| C-02 | Bug           | Coverage ignored the project's access state.                                                                                                                                              | A project in migration or recovery reported its capabilities as available.                                                                                                                                              | A new `blocked_by_state` status, with the reason.                                                                                                                        |
| C-03 | Bug           | Coverage ignored the caller's scopes.                                                                                                                                                     | A read-only grant reported staging capabilities as available.                                                                                                                                                           | Missing scopes are reported as blockers on the row.                                                                                                                      |
| C-04 | Bug           | The coverage verdict was derived from `executionIntent`. A program declaring `requires_registered_operations` with **no** requested capabilities reported `ready_for_operation_planning`. | Readiness concluded from an empty check.                                                                                                                                                                                | The verdict is computed from the coverage rows; an empty request set with execution intent is `blocked_by_capability` with a warning that the execution step is missing. |
| C-05 | Bug           | `queryModel` used `toLocaleLowerCase()`.                                                                                                                                                  | Locale-dependent search: the same query returns different results on a Turkish host. This repository treats cross-platform determinism as a requirement.                                                                | `toLowerCase()`.                                                                                                                                                         |
| C-06 | Bug           | Field names, entity kinds, scopes, derived outputs and snapshot count keys all shared the operation-type pattern `^[a-z][a-z0-9_.:-]*$`.                                                  | `fields: ["hostWallId"]` - the exact spelling every `@arq/bim-core` property uses - was rejected, so the projection feature could not address any real field. The same pattern accepted `a:::---` as an operation type. | Six separate grammars in `schema/identifiers.ts`, each with a hint written for the reader of an error.                                                                   |
| C-07 | Bug           | `SemanticVersionSchema` was `^[0-9]+\.[0-9]+\.[0-9]+$`.                                                                                                                                   | `01.2.3` passed, and catalogue lookup is string equality, so a leading zero silently missed a registered operation.                                                                                                     | Strict semver with no leading zeros.                                                                                                                                     |
| C-08 | Bug           | `ArqService.execute` ran the success-describing callback inside the `try`.                                                                                                                | A bug in the code that phrased a **successful** result was reported as an internal server error.                                                                                                                        | `service/tool-service.ts` runs the work first and describes afterwards.                                                                                                  |
| C-09 | Design defect | Seven of eleven declared proposal states were unreachable: `staged`, `approved`, `committing`, `rejected`, `expired`, `failed`, and `superseded` outside a test-only helper.              | Reviewers read a type as behaviour.                                                                                                                                                                                     | `domain/proposal.ts` enumerates every transition; a test walks the graph and asserts every declared state is reachable.                                                  |
| C-10 | Design defect | `expired` existed but nothing measured age, because `Date.now()` was called inline.                                                                                                       | A proposal staged against a long-gone revision stayed reviewable indefinitely.                                                                                                                                          | Clock injection (`runtime/clock.ts`); expiry and supersession are computed on read.                                                                                      |
| C-11 | Design defect | Advertised limits and enforced limits were separate literals; design programs had no advertised ceiling at all.                                                                           | Silent drift in the worse direction.                                                                                                                                                                                    | `domain/limits.ts` is the single source; a test asserts the capability report and the schemas agree.                                                                     |
| C-12 | Design defect | `interfaceComponentIds` was validated as a reference list, never as a relation.                                                                                                           | One component could declare an interface the other side never had to honour.                                                                                                                                            | Interfaces must be mutual.                                                                                                                                               |
| C-13 | Design defect | Cycle detection reported "the graph contains a cycle" against the whole array.                                                                                                            | For a 200-item plan, an instruction to re-read 200 items.                                                                                                                                                               | `domain/graph.ts` returns the path that closes the cycle, iteratively, so a 50,000-node graph does not overflow the stack.                                               |
| C-14 | Design defect | Item counts were bounded; serialised response size was not.                                                                                                                               | A page of 200 wide elements could exceed what a client accepts, failing as truncation rather than as a request to narrow.                                                                                               | `MAX_TOOL_RESULT_BYTES`, enforced in the envelope, with a refusal that says how to ask for less.                                                                         |

### 2.3 Resource and lifecycle

| ID   | Kind          | Defect in 2.0                                                                                    | Consequence                                                                                                                     | Fix                                                                                                                                     |
| ---- | ------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | Bug           | The idempotency map was unbounded, never expired, and stored full results.                       | A memory leak and a permanent second copy of every brief and proposal, in a process meant to live as long as an editor session. | `adapter/idempotency.ts`: per-grant keys, expiry, capacity, oldest-first eviction.                                                      |
| R-02 | Bug           | Proposals, briefs and design programs accumulated for ever.                                      | Same.                                                                                                                           | Proposals are capped per project, evicting oldest terminal ones and never a live one.                                                   |
| R-03 | Design defect | No client-initiated withdrawal.                                                                  | An assistant that realised its proposal was wrong could only leave it in the operator's queue or stage a second one beside it.  | `arq_cancel_changeset`, and a `cancelled` state.                                                                                        |
| R-04 | Design defect | Asymmetric surface: briefs and design programs could be written and never read.                  | An assistant that lost context rewrote the plan under a new identifier.                                                         | `arq_get_brief`, `arq_list_briefs`, `arq_get_design_program`, `arq_list_design_programs`, `arq_list_changesets`, `arq_get_audit_trail`. |
| R-05 | Design defect | The History tab specification required design-program versions; the schema had no version field. | Unimplementable as specified.                                                                                                   | Re-saving a program increments a version.                                                                                               |

### 2.4 Architecture

| ID   | Kind          | Defect in 2.0                                                                                                                                                                                                                     | Consequence                                                                                                                        | Fix                                                                                                                                                               |
| ---- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Design defect | Domain profiles were the centre of the architecture - a ten-row contract, an ADR, a coverage tool that is meaningless without them - and there was no profile type, registry, schema or fixture. The word appeared only in prose. | "Unavailable" could not name what was missing.                                                                                     | `profile/domain-profile.ts`, `profile/profile-registry.ts`, a registered `architecture` profile and a `declared_unregistered` `vehicle.concept` profile.          |
| A-02 | Design defect | Schema drift was handled by a generator plus a drift check.                                                                                                                                                                       | A generator detects drift after it happens.                                                                                        | One `Validator` carries both the runtime check and its JSON Schema (`schema/schema.ts`). Drift is unrepresentable.                                                |
| A-03 | Design defect | The mock adapter **was** the implementation: 1,070 lines a real adapter would have had to reimplement.                                                                                                                            | Fixture and live runs would share no behaviour.                                                                                    | One bridge over a swappable `ArqProjectHost`. A fixture run and a live run differ by which host was constructed.                                                  |
| A-04 | Design defect | Validation and application were separate code paths in the fixture adapter.                                                                                                                                                       | "A rejected proposal leaves canonical state unchanged" was a claim to be reviewed.                                                 | `runBatch` is used by both; `validate` discards the candidate state and `apply` swaps it in. The property is structural.                                          |
| A-05 | Design defect | Pinned `@modelcontextprotocol/server@2.0.0` and `zod@4.4.3`.                                                                                                                                                                      | The parsing, framing and error mapping of the product's untrusted-input boundary supplied by versions this repository never reads. | Zero new dependencies. The protocol is implemented in `mcp/protocol.ts`; it is smaller than the audit it replaces.                                                |
| A-06 | Design defect | The UX specification was 262 lines of prose and no code.                                                                                                                                                                          | Header copy in a document, disabled buttons in a component, nothing connecting them.                                               | `review/review-centre.ts` derives header copy, action availability with a mandatory reason, tab visibility and the accessible impact summary from the same state. |

## 3. What "create anything" means, precisely

The requirement is that someone can describe any object - the worked example was
a fictional aircraft from a film - and get real work out of the system. The
honest form of that promise has four steps, and the system must never skip one.

1. **Describe.** A design program can describe any domain, in full: components,
   mutual interfaces, verifiable requirements, a dependency-ordered task graph,
   cited sources with rights status, and the questions still open. This layer
   has no domain restriction at all.
2. **Check.** Coverage compares what the program asks for against the operations
   Arq has registered, for a named project and this connection's permissions.
3. **Answer honestly when it fails.** An unregistered domain returns the profile
   that would own the work, the operations it would need, and the specific
   blockers. For `vehicle.concept` that is seven blockers, from "no accepted
   product decision that Arq authors non-architectural domains" to "no renderer,
   selection or direct-manipulation behaviour for three-dimensional
   assemblies".
4. **Execute only what is registered.** A change set may name only catalogued
   operations at catalogued versions.

The failure mode this prevents is substitution: calling a fuselage a wall
because `architecture.wall.create` exists and `vehicle.concept.fuselage.create`
does not. That produces geometry that satisfies a schema and means nothing, and
it is the single most likely way an assistant "succeeds" at a request it should
have refused. Coverage, the tool descriptions, the prompts and the profile
registry all say the same sentence: do not substitute an operation from a
different profile.

The productive result of a refusal is a specification. For the aircraft example
the system returns a complete component plan, an interface graph, requirements,
a task order, the five operations a `vehicle.concept` profile would need, and
the seven decisions and implementations standing in the way. That is a
reviewable backlog, which is a materially better answer than either a refusal or
a fabricated model.

### Protected references

Naming a film, a building, a product or a brand records a source; it does not
create a right to reproduce it. The system keeps the reference with its
provenance and reuse status, works from functional requirements instead, and
cannot record an attestation that reuse is permitted - only the operator can, in
Arq. A rights label is a workflow signal, not a legal conclusion.

## 4. What is implemented, and what is not

Claims are graded with this repository's own evidence vocabulary.

| Claim                                                                          | Evidence            | Where                                                                               |
| ------------------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------- |
| MCP protocol: handshake, version negotiation, tools, resources, prompts        | verified            | `mcp/*.test.ts`, 23 tests including a full client journey                           |
| 24 tools, no commit, approve, path or query-language tool                      | verified            | scope table and tool table asserted equal in both directions                        |
| Grants, scopes, expiry, revocation, project isolation                          | verified            | `grant/grant.test.ts`, `adapter/bridge-adapter.test.ts`                             |
| Operations validated by the real `@arq/validation` and `@arq/operations` rules | verified            | `host/memory-project-host.test.ts`                                                  |
| Atomic application, grouped undo, commit-time revalidation                     | verified            | same                                                                                |
| Capability coverage against a real registry                                    | verified            | `adapter/coverage.ts` and its tests                                                 |
| Review Centre state, copy and action gating                                    | verified as a model | `review/review-centre.test.ts`                                                      |
| The Assistant panel as rendered UI in `apps/web`                               | not implemented     | the model exists; no React surface consumes it yet                                  |
| `.arq` file writing, opening, publication                                      | blocked             | STATUS.md records no end-to-end project open; publication stays an operator request |
| Live acceptance against Claude Code, Cursor, Codex, ChatGPT                    | not inspected       | configuration templates are published; no recorded client run exists                |
| Remote gateway, OAuth, tenancy                                                 | blocked             | no hosted endpoint, authorization server or isolation implementation                |

Nothing in this document claims that Arq ships public AI authoring, that the
protected architectural workflow is released, or that any client has been
tested against this server.

## 5. Delivery order

Each phase ends with evidence, and no phase starts before the one before it has
some.

| Phase    | Goal                                                       | Exit                                                                                                                                                                       |
| -------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 (done) | The boundary in the repository, wired to the real packages | This package, its 256 tests, and ADR-0027                                                                                                                                  |
| 1        | The application bridge                                     | `apps/web` (or the desktop shell) implements `ArqProjectHost` over the live project context and owns `ArqOperatorSurface`                                                  |
| 2        | Grant issuing in Arq                                       | A pairing and sharing surface that mints `GrantContext`, with revocation reaching a live connection on the next call                                                       |
| 3        | The Assistant panel                                        | A React surface over `review/review-centre.ts`, keyboard-operable, with the accessible impact summary as the canvas highlight's text equivalent                            |
| 4        | Client acceptance                                          | A recorded run per client and version; support is claimed per client, never inferred from another                                                                          |
| 5        | Publication                                                | Only after an end-to-end project-open pipeline exists; `fileImpact` on the architecture profile changes in the same commit                                                 |
| 6        | A second domain profile                                    | An accepted ADR first. The profile contract's ten areas are the checklist, and `vehicle.concept`'s blocker list is the worked example of what has to be answered           |
| 7        | Remote access                                              | An architecture project, not a configuration task: authorization server, token audience and resource checks, tenancy, revocation, retention, abuse controls, kill switches |

## 6. Decisions this package makes, and their alternatives

| Decision                         | Alternative considered                  | Why not                                                                                                                                                                                                                                                                    |
| -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero new dependencies            | Use the official MCP SDK and Zod        | The protocol is ~200 lines and this is the product's untrusted-input boundary. A pinned dependency here is unreviewed parsing in the place least able to afford it, and it would be the only workspace package with a runtime dependency that is not genuinely specialist. |
| One bridge over a swappable host | A fixture adapter and a runtime adapter | Two implementations share no behaviour, which is precisely how 2.0's fixture proved nothing about a future live path.                                                                                                                                                      |
| Commit on a separate object      | A commit method guarded by a flag       | A flag can be set. An object that is never passed cannot be called.                                                                                                                                                                                                        |
| Profiles carry evidence states   | Profiles carry documentation            | A catalogue that mixes specification with implementation is a catalogue a model will read as capability.                                                                                                                                                                   |
| Coverage returns four statuses   | Available and unavailable only          | "Registered but not usable here" and "unknown because no project was named" are different problems with different fixes.                                                                                                                                                   |

## 7. Open questions for the owner

1. Is a second domain profile a product direction, or is `vehicle.concept`
   permanently a worked example of the refusal path? ADR-0002 commits to a
   plan-first semantic building model.
2. Where do plans live once the application bridge exists: a sidecar, an Arq
   account store, or a governed project resource? The retention, export and
   deletion policy follows from that choice, and this package deliberately does
   not decide it.
3. Which client versions will be named as supported, and who records the
   acceptance runs?
4. Does the pairing surface belong to the desktop shell, the web app, or both?

## 8. Related

- ADR-0027: the MCP boundary and domain profiles
- ADR-0014: AI creates previewable typed operations through ArqScript
- ADR-0005: typed operations
- `docs/ai/SECURITY-THREAT-MODEL.md`, `docs/ai/AI-GUARDRAILS.md`
- `packages/mcp-server/README.md`

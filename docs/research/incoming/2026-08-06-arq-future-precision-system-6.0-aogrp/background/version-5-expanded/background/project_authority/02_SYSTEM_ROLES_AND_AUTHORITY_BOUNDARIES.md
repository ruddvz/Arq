---
source_id: ARQ-OS3-SYSTEM-ROLES
source_type: governance
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ architecture owner
---

# System roles and authority boundaries

## Role matrix

| System | Owns | May do | Must not do |
|---|---|---|---|
| ARQ Operator OS Project | Source retrieval, cross-system context, external research, task framing, evidence summaries | Reconcile sources, prepare handoffs, critique, create local packages | Replace repository invariants, merge gates, language authority, or runtime controls |
| ZEUS 5.0 | Repository task classification, routing, method selection, local execution, local evidence | Compile tasks, run checks, repair within authority, raise impact | Lower Engineering OS lanes, mark missing proof as passed, decide governed language |
| Engineering OS 5.0 | Base-to-head classification, selected evidence, merge and release gate | Require checks, preserve proof gaps, enforce protected approvals | Invent product truth or bypass source ownership |
| ARQ Language System 4.1 | Canonical terminology, state language, public claims, wording conflicts | Gate copy and rendered public surfaces | Declare technical checks or release approval passed |
| GitHub | Canonical source, review history, commits, pull requests, CI records | Store and review code, run checks, enforce rulesets | Establish production runtime truth without deployment evidence |
| Vercel | Build, preview, production deployment, route and runtime evidence | Deploy identified revisions, expose logs, support rollback | Become canonical project storage or hide source provenance |
| ARQ MCP boundary | Governed AI client access to typed project operations | Expose scoped, revocable, validated operations | Bypass permissions, approval, validation, provenance, or undo |
| Human owner | Product authority, destructive consent, unresolved decisions, release approval where required | Approve, reject, prioritise, resolve ownership conflicts | Delegate irreversible authority implicitly through connector access |

## Connector permission rule

A connector reporting `push`, `admin`, deployment, environment, or log capability proves only that the tool can attempt an action. It does not prove that the user requested the action, that the action is safe, or that required repository and release gates passed.

## No duplicate control planes

Do not add a second copy of:

- ARQ invariants
- ZEUS routing modules
- Engineering OS lane or evidence maps
- Language System vocabulary or claims registry
- ADR directory
- repository status source
- release gate
- MCP operation definitions

This Project may reference those sources and package an exact handoff. It must not fork them.

## Cross-system handoff

The Project prepares a typed task record. ZEUS resolves it against live repository state. Engineering OS decides minimum merge evidence. The Language System checks governed wording. GitHub records review and CI. Vercel proves deployment and runtime state. The final report reconciles these records without promoting any one system beyond its role.

## Stop and escalate

Stop before mutation when:

- the requested base branch or repository is ambiguous;
- a destructive or irreversible action lacks explicit consent;
- an ADR ID, source authority, schema, migration, or platform decision conflicts;
- a deployment cannot be tied to an expected commit;
- protected evidence is stale, cached, missing, or from another revision;
- a public claim has no valid Language System binding;
- credentials, private project data, or production secrets could be exposed.

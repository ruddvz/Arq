---
source_id: ARQ-OS3-SECURITY-BRIDGE
source_type: security-and-privacy
class: C
status: active-requirements
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ security owner
---

# Security, privacy, data, and supply chain

## Evidence boundary

Requirements are not implementation evidence. A security statement must name the control, code or configuration, test, revision, owner, limitation, and deployment where it applies.

## Required threat surfaces

- untrusted `.arq`, SQLite, DXF, IFC, PDF, image, archive, and attachment inputs;
- parser resource exhaustion and malformed geometry;
- path traversal, symlink, zip bomb, oversized file, and content-sniffing attacks;
- browser storage, OPFS, IndexedDB, journals, snapshots, caches, and deletion;
- MCP grants, tool input, replay, revocation, prompt injection, and data minimisation;
- GitHub tokens, Vercel tokens, environment variables, logs, artifacts, and previews;
- dependencies, native builds, WASM artifacts, licences, SBOM, and compromised packages;
- analytics, diagnostics, crash reports, support bundles, and project metadata;
- collaboration and sync when introduced;
- release, rollback, incident, and evidence integrity.

## Minimum controls

- data inventory and classification;
- trust-boundary diagram;
- least privilege and scoped credentials;
- secrets excluded from prompts, logs, URLs, artifacts, and client bundles;
- file-size, recursion, time, memory, and entity-count limits;
- sandboxing or isolation appropriate to parsers and generated code;
- safe temporary-file and path handling;
- copy-on-write migration and source preservation;
- redaction tested recursively through arrays and nested objects;
- dependency pinning and provenance;
- licence and SBOM checks;
- secret scanning with regression fixtures;
- vulnerability handling and incident ownership;
- retention, deletion, export, and recovery policy;
- opt-in support bundles when project context may be included;
- production and preview environment separation;
- audit events for consequential external and AI actions.

## Connected-system safety

Do not include secret values in the Project source registry or integration snapshot. Record only identifiers, scopes, environments, and presence where useful. Before external writes, show the action target and user-visible consequence.

## Public privacy claims

A network-observation test can support a scoped statement about observed requests in a tested flow. It cannot prove that no data ever leaves the device across all code paths, environments, integrations, or future versions. The approved privacy statement and conflict registry must govern the final claim.

## Security release evidence

Use a record containing:

- threat-model revision;
- changed boundaries;
- controls affected;
- tests and fuzz corpus;
- secret and dependency scan results;
- permissions and negative tests;
- privacy data-flow result;
- incident and rollback readiness;
- residual risks and owner acceptance.

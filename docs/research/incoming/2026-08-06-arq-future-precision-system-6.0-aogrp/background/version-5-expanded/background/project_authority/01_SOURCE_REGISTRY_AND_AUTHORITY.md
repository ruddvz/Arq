---
source_id: ARQ-OS31-SOURCE-REGISTRY
source_type: governance
class: C
status: active
version: 3.1.0
effective_date: 2026-08-04
owner: ARQ project owner
---

# Source registry and authority

## Core rule

This registry governs Project retrieval. It is not higher than the live ARQ repository. It cannot override accepted repository ADRs, code, schemas, deterministic gates, governed language, or evidence tied to an immutable revision.

## Authority by question

### Current implementation

1. Live repository at an immutable commit.
2. Code, schemas, migrations, generated artifacts, and real tests at that commit.
3. CI and deployment evidence tied to the same commit.
4. Directly observed runtime tied to an identified deployment.
5. Current repository status summaries that remain consistent with the evidence above.

### Intended product and architecture

1. Accepted repository ADRs.
2. Active contracts and schemas.
3. Registered blueprint and release scope.
4. Approved decisions and specifications.
5. Proposals, research, mock-ups, and external recommendations.

### Merge, release, and language

Engineering OS is the deterministic merge and release authority. ZEUS may classify, route, execute, and raise requirements, but cannot lower Engineering OS gates. The ARQ Language System owns governed vocabulary, state language, public claims, and claim conflicts.

## Source classes

| Class | Meaning |
|---|---|
| A | Immutable implementation, test, CI, deployment, or runtime evidence |
| B | Accepted ADR, contract, schema, or approved decision |
| C | Active Project operating source |
| D | Current authoritative external source |
| E | Proposal, research, audit, mock-up, or implementation pack |
| F | Historical, stale, superseded, or illustrative material |

Class C, D, E, and F sources do not establish current implementation truth by themselves.

## Conflict and staleness

Record exact competing claims, owners, revisions, and evidence. Separate current implementation from intended design. Prefer the authority that owns the question. Block consequential implementation or current-tense publication when a material conflict remains unresolved. Resolve architecture through repository decision governance, language through the Language System, and release evidence through Engineering OS.

Connected-system snapshots must name an observation time and expiry. After expiry, treat them as historical until refreshed.

## Active Project source set

Exactly these 24 files are active:

| `00_README_FIRST.md` | ARQ-OS31-00 | Active Project source |
| `01_SOURCE_REGISTRY_AND_AUTHORITY.md` | ARQ-OS31-01 | Active Project source |
| `02_SYSTEM_ROLES_AND_AUTHORITY_BOUNDARIES.md` | ARQ-OS31-02 | Active Project source |
| `03_LIVE_REPOSITORY_AND_DEPLOYMENT_SNAPSHOT.md` | ARQ-OS31-03 | Active Project source |
| `04_PRODUCT_SCOPE_AND_PROTECTED_WORKFLOW.md` | ARQ-OS31-04 | Active Project source |
| `05_ARCHITECTURE_FILE_STATE_AND_INVARIANT_BRIDGE.md` | ARQ-OS31-05 | Active Project source |
| `06_TASK_COMPILATION_AND_EXECUTION_HANDOFF.md` | ARQ-OS31-06 | Active Project source |
| `07_GITHUB_CHANGE_CONTROL_PROTOCOL.md` | ARQ-OS31-07 | Active Project source |
| `08_VERCEL_DEPLOYMENT_AND_PRODUCTION_PROTOCOL.md` | ARQ-OS31-08 | Active Project source |
| `09_AI_MCP_AUTOMATION_TRUST_BOUNDARY.md` | ARQ-OS31-09 | Active Project source |
| `10_UX_LANGUAGE_BRAND_AND_PUBLIC_CLAIMS.md` | ARQ-OS31-10 | Active Project source |
| `11_SECURITY_PRIVACY_DATA_AND_SUPPLY_CHAIN.md` | ARQ-OS31-11 | Active Project source |
| `12_PLATFORM_PERFORMANCE_TEST_AND_EVIDENCE.md` | ARQ-OS31-12 | Active Project source |
| `13_RELEASE_INCIDENT_ROLLBACK_AND_EVIDENCE_GATES.md` | ARQ-OS31-13 | Active Project source |
| `14_DECISIONS_RISKS_CONFLICTS_AND_OPEN_QUESTIONS.md` | ARQ-OS31-14 | Active Project source |
| `15_SOURCE_MAINTENANCE_AND_PROJECT_UPLOAD_GUIDE.md` | ARQ-OS31-15 | Active Project source |
| `16_EVIDENCE_STATES_AND_VERIFICATION_LEDGER.md` | ARQ-OS31-16 | Active Project source |
| `17_INTEGRATION_CONTRACTS_AND_SCHEMAS.md` | ARQ-OS31-17 | Active Project source |
| `18_OPERATOR_TEMPLATES.md` | ARQ-OS31-18 | Active Project source |
| `19_OPERATOR_WORKFLOWS.md` | ARQ-OS31-19 | Active Project source |
| `20_CRITIQUE_AND_IMPROVEMENT_REPORT.md` | ARQ-OS31-20 | Active Project source |
| `21_MIGRATION_FROM_OPERATOR_OS_2.md` | ARQ-OS31-21 | Active Project source |
| `22_REPOSITORY_IMPLEMENTATION_PROMPT.md` | ARQ-OS31-22 | Active Project source |
| `23_CHANGELOG_AND_VALIDATION.md` | ARQ-OS31-23 | Active Project source |

`ARQ_PROJECT_INSTRUCTIONS.txt` is not a Project source. Paste it into Project settings.

## Source maintenance rule

Use stable filenames and unique source IDs. Replace superseded sources instead of keeping multiple active versions. Never upload secrets, private tokens, unrelated personal data, build caches, duplicate ZIPs, or copied repository control-plane trees merely to increase context.
